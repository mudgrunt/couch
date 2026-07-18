<script setup lang="ts">
import GameRow from './GameRow.vue'
defineProps<{ games: Record<string, unknown>[] }>()
</script>

<template>
  <table class="game-list">
    <thead>
      <tr>
        <th>Title</th>
        <th>Library</th>
        <th>Release</th>
        <th>Size</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      <GameRow v-for="game in games" :key="game.id as number" :game="game" />
    </tbody>
  </table>
</template>

<style scoped>
.game-list {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}
th {
  text-align: left;
  padding: 0.5rem 0.75rem;
  border-bottom: 2px solid #2a2a3e;
  font-weight: 600;
}
</style>
