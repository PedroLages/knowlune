import { Extension } from '@tiptap/core'
import { Suggestion, type SuggestionOptions } from '@tiptap/suggestion'
import type { SlashCommandItem } from './SlashCommandList'

export interface SlashCommandOptions {
  suggestion: Omit<SuggestionOptions<SlashCommandItem>, 'editor'>
}

export const SlashCommand = Extension.create<SlashCommandOptions>({
  name: 'slashCommand',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        startOfLine: false,
        command: ({ editor, range, props }) => {
          // Delete the slash trigger text before executing the command
          editor.chain().focus().deleteRange(range).run()
          props.command(editor)
        },
      },
    }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ]
  },
})
