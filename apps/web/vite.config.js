import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: (() => {
      // monorepo: monaco-editor is installed at the workspace root node_modules.
      const workspaceRoot = path.resolve(__dirname, '..', '..')
      return {
        'monaco-editor': path.resolve(workspaceRoot, 'node_modules/monaco-editor'),
        'monaco-editor/esm/vs/editor/editor.api.js': path.resolve(workspaceRoot, 'node_modules/monaco-editor/esm/vs/editor/editor.api.js')
      }
    })()
  },
  optimizeDeps: {
    // Pre-bundle Monaco and related packages so Vite can resolve deep imports
    include: ['@monaco-editor/react', 'y-monaco', 'monaco-editor/esm/vs/editor/editor.api.js']
  }
})
