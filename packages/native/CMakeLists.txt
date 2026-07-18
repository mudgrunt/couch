cmake_minimum_required(VERSION 3.15)
cmake_policy(SET CMP0091 NEW)  # enables MSVC_RUNTIME_LIBRARY property
project(capture)

# ── cmake-js integration ──────────────────────────────────────────────────
# cmake-js injects these variables when it invokes CMake.
include_directories(${CMAKE_JS_INC})

# ── Sources ───────────────────────────────────────────────────────────────
set(SOURCES
  src/capture.cc
)

if(WIN32)
  list(APPEND SOURCES src/capture_win.cc)
elseif(APPLE)
  list(APPEND SOURCES src/capture_mac.mm)
elseif(UNIX)
  list(APPEND SOURCES src/capture_linux.cc)
endif()

# ── Addon target ──────────────────────────────────────────────────────────
add_library(${PROJECT_NAME} SHARED ${SOURCES} ${CMAKE_JS_SRC})
set_target_properties(${PROJECT_NAME} PROPERTIES PREFIX "" SUFFIX ".node")

target_compile_definitions(${PROJECT_NAME} PRIVATE NAPI_DISABLE_CPP_EXCEPTIONS)

# ── C++ standard ─────────────────────────────────────────────────────────
target_compile_features(${PROJECT_NAME} PRIVATE cxx_std_17)

# ── node-addon-api headers ────────────────────────────────────────────────
execute_process(
  COMMAND node -p "require('node-addon-api').include"
  WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
  OUTPUT_VARIABLE NODE_ADDON_API_DIR
  OUTPUT_STRIP_TRAILING_WHITESPACE
)
# node -p wraps the path in quotes — strip them
string(REPLACE "\"" "" NODE_ADDON_API_DIR ${NODE_ADDON_API_DIR})
target_include_directories(${PROJECT_NAME} PRIVATE ${NODE_ADDON_API_DIR})

# ── Link cmake-js libraries ───────────────────────────────────────────────
target_link_libraries(${PROJECT_NAME} ${CMAKE_JS_LIB})

# ── Windows-specific ─────────────────────────────────────────────────────
if(WIN32)
  # Find the latest Windows SDK for C++/WinRT headers
  set(WIN_KIT_ROOT "C:/Program Files (x86)/Windows Kits/10/Include")
  file(GLOB WIN_KIT_VERSIONS RELATIVE ${WIN_KIT_ROOT} "${WIN_KIT_ROOT}/10.*")
  list(SORT WIN_KIT_VERSIONS ORDER DESCENDING)
  list(GET WIN_KIT_VERSIONS 0 WIN_KIT_VERSION)
  target_include_directories(${PROJECT_NAME} PRIVATE
    "${WIN_KIT_ROOT}/${WIN_KIT_VERSION}/cppwinrt"
  )

  # FFmpeg (vendored static libs)
  target_include_directories(${PROJECT_NAME} PRIVATE
    ${CMAKE_SOURCE_DIR}/vendor/ffmpeg/windows/include
  )
  target_link_libraries(${PROJECT_NAME}
    ${CMAKE_SOURCE_DIR}/vendor/ffmpeg/windows/lib/avcodec.lib
    ${CMAKE_SOURCE_DIR}/vendor/ffmpeg/windows/lib/avformat.lib
    ${CMAKE_SOURCE_DIR}/vendor/ffmpeg/windows/lib/avutil.lib
    ${CMAKE_SOURCE_DIR}/vendor/ffmpeg/windows/lib/swscale.lib
  )

  # Windows system libs required by D3D11, WinRT, and FFmpeg
  target_link_libraries(${PROJECT_NAME}
    d3d11 dxgi windowsapp ole32
    bcrypt ws2_32 secur32 mfuuid strmiids
  )

  # MSVC: enable exceptions and set runtime to match Node.js (/MD)
  target_compile_options(${PROJECT_NAME} PRIVATE /EHsc)
  set_target_properties(${PROJECT_NAME} PROPERTIES
    MSVC_RUNTIME_LIBRARY "MultiThreadedDLL"
  )
endif()

# ── macOS-specific ────────────────────────────────────────────────────────
if(APPLE)
  target_link_libraries(${PROJECT_NAME}
    "-framework ScreenCaptureKit"
    "-framework VideoToolbox"
    "-framework CoreGraphics"
    "-framework CoreMedia"
    "-framework CoreVideo"
    "-framework Foundation"
  )
  # Compile .mm files as Objective-C++
  set_source_files_properties(src/capture_mac.mm PROPERTIES
    COMPILE_FLAGS "-x objective-c++"
  )
endif()

# ── Linux-specific ────────────────────────────────────────────────────────
if(UNIX AND NOT APPLE)
  find_package(PkgConfig REQUIRED)
  pkg_check_modules(PIPEWIRE REQUIRED libpipewire-0.3)
  pkg_check_modules(GIO REQUIRED gio-2.0)
  pkg_check_modules(FFMPEG REQUIRED
    libavcodec libavformat libavutil libswscale
  )

  target_include_directories(${PROJECT_NAME} PRIVATE
    ${PIPEWIRE_INCLUDE_DIRS}
    ${GIO_INCLUDE_DIRS}
    ${FFMPEG_INCLUDE_DIRS}
  )
  target_link_libraries(${PROJECT_NAME}
    ${PIPEWIRE_LIBRARIES}
    ${GIO_LIBRARIES}
    ${FFMPEG_LIBRARIES}
  )
endif()
