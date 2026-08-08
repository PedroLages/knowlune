export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type GenericRelationship = {
  foreignKeyName: string
  columns: string[]
  isOneToOne: boolean
  referencedRelation: string
  referencedColumns: string[]
}

type GenericTable = {
  Row: Record<string, unknown>
  Insert: Record<string, unknown>
  Update: Record<string, unknown>
  Relationships: GenericRelationship[]
}

type GenericFunction = {
  Args: Record<string, unknown>
  Returns: unknown
}

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5'
  }
  public: {
    Tables: {
      [tableName: string]: GenericTable
      ai_usage_events: {
        Row: {
          course_id: string | null
          created_at: string
          duration_ms: number | null
          feature_type: string
          id: string
          metadata: Json
          status: string
          timestamp: string
          user_id: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          duration_ms?: number | null
          feature_type: string
          id: string
          metadata?: Json
          status: string
          timestamp: string
          user_id: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          duration_ms?: number | null
          feature_type?: string
          id?: string
          metadata?: Json
          status?: string
          timestamp?: string
          user_id?: string
        }
        Relationships: []
      }
      audio_bookmarks: {
        Row: {
          book_id: string
          chapter_index: number
          created_at: string
          id: string
          note: string | null
          timestamp_seconds: number
          user_id: string
        }
        Insert: {
          book_id: string
          chapter_index?: number
          created_at?: string
          id?: string
          note?: string | null
          timestamp_seconds?: number
          user_id: string
        }
        Update: {
          book_id?: string
          chapter_index?: number
          created_at?: string
          id?: string
          note?: string | null
          timestamp_seconds?: number
          user_id?: string
        }
        Relationships: []
      }
      audio_clips: {
        Row: {
          book_id: string
          chapter_id: string
          chapter_index: number
          created_at: string
          end_time: number
          id: string
          sort_order: number
          start_time: number
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          book_id: string
          chapter_id: string
          chapter_index?: number
          created_at?: string
          end_time?: number
          id?: string
          sort_order?: number
          start_time?: number
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          book_id?: string
          chapter_id?: string
          chapter_index?: number
          created_at?: string
          end_time?: number
          id?: string
          sort_order?: number
          start_time?: number
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audiobookshelf_servers: {
        Row: {
          created_at: string
          id: string
          last_synced_at: string | null
          library_ids: Json
          name: string
          status: string
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id: string
          last_synced_at?: string | null
          library_ids?: Json
          name: string
          status?: string
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_synced_at?: string | null
          library_ids?: Json
          name?: string
          status?: string
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      authors: {
        Row: {
          bio: string | null
          course_ids: string[]
          created_at: string
          education: string | null
          featured_quote: string | null
          id: string
          is_preseeded: boolean
          name: string
          photo_url: string | null
          short_bio: string | null
          social_links: Json | null
          specialties: string[] | null
          title: string | null
          updated_at: string
          user_id: string
          years_experience: number | null
        }
        Insert: {
          bio?: string | null
          course_ids?: string[]
          created_at?: string
          education?: string | null
          featured_quote?: string | null
          id?: string
          is_preseeded?: boolean
          name: string
          photo_url?: string | null
          short_bio?: string | null
          social_links?: Json | null
          specialties?: string[] | null
          title?: string | null
          updated_at?: string
          user_id: string
          years_experience?: number | null
        }
        Update: {
          bio?: string | null
          course_ids?: string[]
          created_at?: string
          education?: string | null
          featured_quote?: string | null
          id?: string
          is_preseeded?: boolean
          name?: string
          photo_url?: string | null
          short_bio?: string | null
          social_links?: Json | null
          specialties?: string[] | null
          title?: string | null
          updated_at?: string
          user_id?: string
          years_experience?: number | null
        }
        Relationships: []
      }
      book_highlights: {
        Row: {
          book_id: string
          cfi_range: string | null
          chapter_href: string | null
          color: string
          created_at: string
          flashcard_id: string | null
          id: string
          last_reviewed_at: string | null
          note: string | null
          position: Json | null
          review_rating: string | null
          text_anchor: string
          text_context: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          book_id: string
          cfi_range?: string | null
          chapter_href?: string | null
          color?: string
          created_at?: string
          flashcard_id?: string | null
          id?: string
          last_reviewed_at?: string | null
          note?: string | null
          position?: Json | null
          review_rating?: string | null
          text_anchor?: string
          text_context?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          book_id?: string
          cfi_range?: string | null
          chapter_href?: string | null
          color?: string
          created_at?: string
          flashcard_id?: string | null
          id?: string
          last_reviewed_at?: string | null
          note?: string | null
          position?: Json | null
          review_rating?: string | null
          text_anchor?: string
          text_context?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      book_reviews: {
        Row: {
          book_id: string
          created_at: string
          id: string
          rating: number
          review_text: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          book_id: string
          created_at?: string
          id?: string
          rating: number
          review_text?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          book_id?: string
          created_at?: string
          id?: string
          rating?: number
          review_text?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      book_shelves: {
        Row: {
          added_at: string
          book_id: string
          id: string
          shelf_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          added_at?: string
          book_id: string
          id?: string
          shelf_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          added_at?: string
          book_id?: string
          id?: string
          shelf_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bookmarks: {
        Row: {
          course_id: string
          created_at: string
          id: string
          label: string
          lesson_id: string
          timestamp_seconds: number
          updated_at: string
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          label?: string
          lesson_id: string
          timestamp_seconds?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          label?: string
          lesson_id?: string
          timestamp_seconds?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      books: {
        Row: {
          abs_item_id: string | null
          abs_server_id: string | null
          asin: string | null
          author: string | null
          chapters: Json
          cover_url: string | null
          created_at: string
          current_position: Json | null
          description: string | null
          file_size: number | null
          file_url: string | null
          finished_at: string | null
          format: string
          genre: string | null
          id: string
          isbn: string | null
          last_opened_at: string | null
          linked_book_id: string | null
          narrator: string | null
          playback_speed: number | null
          progress: number
          rating: number | null
          series: string | null
          series_sequence: string | null
          source_type: string
          source_url: string | null
          status: string
          tags: string[]
          title: string
          total_duration: number | null
          total_pages: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          abs_item_id?: string | null
          abs_server_id?: string | null
          asin?: string | null
          author?: string | null
          chapters?: Json
          cover_url?: string | null
          created_at?: string
          current_position?: Json | null
          description?: string | null
          file_size?: number | null
          file_url?: string | null
          finished_at?: string | null
          format?: string
          genre?: string | null
          id?: string
          isbn?: string | null
          last_opened_at?: string | null
          linked_book_id?: string | null
          narrator?: string | null
          playback_speed?: number | null
          progress?: number
          rating?: number | null
          series?: string | null
          series_sequence?: string | null
          source_type: string
          source_url?: string | null
          status?: string
          tags?: string[]
          title: string
          total_duration?: number | null
          total_pages?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          abs_item_id?: string | null
          abs_server_id?: string | null
          asin?: string | null
          author?: string | null
          chapters?: Json
          cover_url?: string | null
          created_at?: string
          current_position?: Json | null
          description?: string | null
          file_size?: number | null
          file_url?: string | null
          finished_at?: string | null
          format?: string
          genre?: string | null
          id?: string
          isbn?: string | null
          last_opened_at?: string | null
          linked_book_id?: string | null
          narrator?: string | null
          playback_speed?: number | null
          progress?: number
          rating?: number | null
          series?: string | null
          series_sequence?: string | null
          source_type?: string
          source_url?: string | null
          status?: string
          tags?: string[]
          title?: string
          total_duration?: number | null
          total_pages?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      calendar_tokens: {
        Row: {
          created_at: string
          id: string
          last_accessed_at: string | null
          timezone: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_accessed_at?: string | null
          timezone?: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_accessed_at?: string | null
          timezone?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      career_paths: {
        Row: {
          created_at: string
          description: string
          icon: string
          id: string
          stages: Json
          title: string
          total_estimated_hours: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description: string
          icon: string
          id: string
          stages?: Json
          title: string
          total_estimated_hours?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          icon?: string
          id?: string
          stages?: Json
          title?: string
          total_estimated_hours?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      challenges: {
        Row: {
          celebrated_milestones: number[]
          completed_at: string | null
          created_at: string
          current_progress: number
          deadline: string
          id: string
          name: string
          target_value: number
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          celebrated_milestones?: number[]
          completed_at?: string | null
          created_at?: string
          current_progress?: number
          deadline: string
          id: string
          name: string
          target_value: number
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          celebrated_milestones?: number[]
          completed_at?: string | null
          created_at?: string
          current_progress?: number
          deadline?: string
          id?: string
          name?: string
          target_value?: number
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chapter_mappings: {
        Row: {
          audio_book_id: string
          computed_at: string | null
          created_at: string
          deleted: boolean
          epub_book_id: string
          mappings: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          audio_book_id: string
          computed_at?: string | null
          created_at?: string
          deleted?: boolean
          epub_book_id: string
          mappings?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          audio_book_id?: string
          computed_at?: string | null
          created_at?: string
          deleted?: boolean
          epub_book_id?: string
          mappings?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_conversations: {
        Row: {
          course_id: string
          created_at: string
          created_at_epoch: number
          hint_level: number
          id: string
          messages: Json
          mode: string
          updated_at: string
          user_id: string
          video_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          created_at_epoch: number
          hint_level?: number
          id?: string
          messages?: Json
          mode?: string
          updated_at?: string
          user_id: string
          video_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          created_at_epoch?: number
          hint_level?: number
          id?: string
          messages?: Json
          mode?: string
          updated_at?: string
          user_id?: string
          video_id?: string
        }
        Relationships: []
      }
      content_progress: {
        Row: {
          completed_at: string | null
          content_id: string
          content_type: string
          created_at: string
          id: string
          progress_pct: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          content_id: string
          content_type: string
          created_at?: string
          id?: string
          progress_pct?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          content_id?: string
          content_type?: string
          created_at?: string
          id?: string
          progress_pct?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      course_reminders: {
        Row: {
          course_id: string | null
          course_name: string
          created_at: string
          days: string[]
          enabled: boolean
          id: string
          time: string
          updated_at: string
          user_id: string
        }
        Insert: {
          course_id?: string | null
          course_name: string
          created_at?: string
          days?: string[]
          enabled?: boolean
          id: string
          time: string
          updated_at?: string
          user_id: string
        }
        Update: {
          course_id?: string | null
          course_name?: string
          created_at?: string
          days?: string[]
          enabled?: boolean
          id?: string
          time?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      course_servers: {
        Row: {
          created_at: string
          id: string
          name: string
          status: string
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id: string
          name: string
          status?: string
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          status?: string
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      embeddings: {
        Row: {
          created_at: string
          id: string
          model: string
          note_id: string
          updated_at: string
          user_id: string
          vector: string
        }
        Insert: {
          created_at?: string
          id?: string
          model?: string
          note_id: string
          updated_at?: string
          user_id: string
          vector: string
        }
        Update: {
          created_at?: string
          id?: string
          model?: string
          note_id?: string
          updated_at?: string
          user_id?: string
          vector?: string
        }
        Relationships: [
          {
            foreignKeyName: 'embeddings_note_id_fkey'
            columns: ['note_id']
            isOneToOne: true
            referencedRelation: 'notes'
            referencedColumns: ['id']
          },
        ]
      }
      entitlements: {
        Row: {
          created_at: string | null
          expires_at: string | null
          had_trial: boolean
          plan_id: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tier: 'free' | 'trial' | 'premium'
          trial_end: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          had_trial?: boolean
          plan_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: 'free' | 'trial' | 'premium'
          trial_end?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          had_trial?: boolean
          plan_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: 'free' | 'trial' | 'premium'
          trial_end?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      export_jobs: {
        Row: {
          attempt_count: number
          completed_at: string | null
          created_at: string
          id: string
          request_id: string
          signed_url: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempt_count?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          request_id?: string
          signed_url?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempt_count?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          request_id?: string
          signed_url?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      flashcard_reviews: {
        Row: {
          created_at: string
          flashcard_id: string
          id: string
          rating: number
          reviewed_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          flashcard_id: string
          id?: string
          rating: number
          reviewed_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          flashcard_id?: string
          id?: string
          rating?: number
          reviewed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'flashcard_reviews_flashcard_id_fkey'
            columns: ['flashcard_id']
            isOneToOne: false
            referencedRelation: 'flashcards'
            referencedColumns: ['id']
          },
        ]
      }
      flashcards: {
        Row: {
          back: string
          course_id: string
          created_at: string
          difficulty: number
          due_date: string | null
          elapsed_days: number
          front: string
          id: string
          lapses: number
          last_rating: number | null
          last_review: string | null
          note_id: string | null
          reps: number
          scheduled_days: number
          source_book_id: string | null
          source_highlight_id: string | null
          source_type: string | null
          stability: number
          state: number
          updated_at: string
          user_id: string
        }
        Insert: {
          back?: string
          course_id: string
          created_at?: string
          difficulty?: number
          due_date?: string | null
          elapsed_days?: number
          front?: string
          id?: string
          lapses?: number
          last_rating?: number | null
          last_review?: string | null
          note_id?: string | null
          reps?: number
          scheduled_days?: number
          source_book_id?: string | null
          source_highlight_id?: string | null
          source_type?: string | null
          stability?: number
          state?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          back?: string
          course_id?: string
          created_at?: string
          difficulty?: number
          due_date?: string | null
          elapsed_days?: number
          front?: string
          id?: string
          lapses?: number
          last_rating?: number | null
          last_review?: string | null
          note_id?: string | null
          reps?: number
          scheduled_days?: number
          source_book_id?: string | null
          source_highlight_id?: string | null
          source_type?: string | null
          stability?: number
          state?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'flashcards_note_id_fkey'
            columns: ['note_id']
            isOneToOne: false
            referencedRelation: 'notes'
            referencedColumns: ['id']
          },
        ]
      }
      imported_courses: {
        Row: {
          author_id: string | null
          category: string
          created_at: string
          description: string | null
          id: string
          imported_at: string
          last_refreshed_at: string | null
          max_resolution_height: number | null
          name: string
          pdf_count: number
          server_id: string | null
          server_path: string | null
          source: string | null
          source_drive_id: string | null
          status: string
          tags: string[]
          thumbnail_url: string | null
          total_duration: number | null
          total_file_size: number | null
          updated_at: string
          user_id: string
          video_count: number
          youtube_channel_id: string | null
          youtube_channel_title: string | null
          youtube_playlist_id: string | null
          youtube_published_at: string | null
          youtube_thumbnail_url: string | null
        }
        Insert: {
          author_id?: string | null
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          imported_at: string
          last_refreshed_at?: string | null
          max_resolution_height?: number | null
          name: string
          pdf_count?: number
          server_id?: string | null
          server_path?: string | null
          source?: string | null
          source_drive_id?: string | null
          status?: string
          tags?: string[]
          thumbnail_url?: string | null
          total_duration?: number | null
          total_file_size?: number | null
          updated_at?: string
          user_id: string
          video_count?: number
          youtube_channel_id?: string | null
          youtube_channel_title?: string | null
          youtube_playlist_id?: string | null
          youtube_published_at?: string | null
          youtube_thumbnail_url?: string | null
        }
        Update: {
          author_id?: string | null
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          imported_at?: string
          last_refreshed_at?: string | null
          max_resolution_height?: number | null
          name?: string
          pdf_count?: number
          server_id?: string | null
          server_path?: string | null
          source?: string | null
          source_drive_id?: string | null
          status?: string
          tags?: string[]
          thumbnail_url?: string | null
          total_duration?: number | null
          total_file_size?: number | null
          updated_at?: string
          user_id?: string
          video_count?: number
          youtube_channel_id?: string | null
          youtube_channel_title?: string | null
          youtube_playlist_id?: string | null
          youtube_published_at?: string | null
          youtube_thumbnail_url?: string | null
        }
        Relationships: []
      }
      imported_pdfs: {
        Row: {
          course_id: string
          created_at: string
          file_url: string | null
          filename: string
          id: string
          module_title: string | null
          page_count: number
          path: string
          server_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          file_url?: string | null
          filename?: string
          id?: string
          module_title?: string | null
          page_count?: number
          path?: string
          server_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          file_url?: string | null
          filename?: string
          id?: string
          module_title?: string | null
          page_count?: number
          path?: string
          server_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      imported_videos: {
        Row: {
          chapters: Json | null
          course_id: string
          created_at: string
          description: string | null
          drive_file_ref: Json | null
          duration: number
          embeddable: boolean | null
          file_size: number | null
          filename: string
          format: string
          height: number | null
          id: string
          module_title: string | null
          order: number
          path: string
          removed_from_youtube: boolean
          server_url: string | null
          thumbnail_url: string | null
          title: string | null
          unembeddable_reason: string | null
          updated_at: string
          user_id: string
          width: number | null
          youtube_url: string | null
          youtube_video_id: string | null
        }
        Insert: {
          chapters?: Json | null
          course_id: string
          created_at?: string
          description?: string | null
          drive_file_ref?: Json | null
          duration?: number
          embeddable?: boolean | null
          file_size?: number | null
          filename?: string
          format?: string
          height?: number | null
          id?: string
          module_title?: string | null
          order?: number
          path?: string
          removed_from_youtube?: boolean
          server_url?: string | null
          thumbnail_url?: string | null
          title?: string | null
          unembeddable_reason?: string | null
          updated_at?: string
          user_id: string
          width?: number | null
          youtube_url?: string | null
          youtube_video_id?: string | null
        }
        Update: {
          chapters?: Json | null
          course_id?: string
          created_at?: string
          description?: string | null
          drive_file_ref?: Json | null
          duration?: number
          embeddable?: boolean | null
          file_size?: number | null
          filename?: string
          format?: string
          height?: number | null
          id?: string
          module_title?: string | null
          order?: number
          path?: string
          removed_from_youtube?: boolean
          server_url?: string | null
          thumbnail_url?: string | null
          title?: string | null
          unembeddable_reason?: string | null
          updated_at?: string
          user_id?: string
          width?: number | null
          youtube_url?: string | null
          youtube_video_id?: string | null
        }
        Relationships: []
      }
      learner_models: {
        Row: {
          course_id: string
          created_at: string
          id: string
          last_session_summary: string
          misconceptions: Json
          preferred_mode: string
          quiz_stats: Json
          strengths: Json
          topics_explored: string[]
          updated_at: string
          user_id: string
          vocabulary_level: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          last_session_summary?: string
          misconceptions?: Json
          preferred_mode?: string
          quiz_stats?: Json
          strengths?: Json
          topics_explored?: string[]
          updated_at?: string
          user_id: string
          vocabulary_level?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          last_session_summary?: string
          misconceptions?: Json
          preferred_mode?: string
          quiz_stats?: Json
          strengths?: Json
          topics_explored?: string[]
          updated_at?: string
          user_id?: string
          vocabulary_level?: string
        }
        Relationships: []
      }
      learning_path_entries: {
        Row: {
          course_id: string
          course_type: string
          created_at: string
          id: string
          is_manually_ordered: boolean
          justification: string | null
          manifest_course_key: string | null
          manifest_ordinal: number | null
          path_id: string
          position: number
          source: string | null
          state: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          course_id: string
          course_type: string
          created_at?: string
          id: string
          is_manually_ordered?: boolean
          justification?: string | null
          manifest_course_key?: string | null
          manifest_ordinal?: number | null
          path_id: string
          position?: number
          source?: string | null
          state?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          course_id?: string
          course_type?: string
          created_at?: string
          id?: string
          is_manually_ordered?: boolean
          justification?: string | null
          manifest_course_key?: string | null
          manifest_ordinal?: number | null
          path_id?: string
          position?: number
          source?: string | null
          state?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'learning_path_entries_path_id_fkey'
            columns: ['path_id']
            isOneToOne: false
            referencedRelation: 'learning_paths'
            referencedColumns: ['id']
          },
        ]
      }
      learning_path_template_entries: {
        Row: {
          course_id: string | null
          estimated_hours: number | null
          id: string
          justification: string | null
          match_title: string | null
          position: number
          template_id: string
          title: string
          topic_tags: string[] | null
        }
        Insert: {
          course_id?: string | null
          estimated_hours?: number | null
          id: string
          justification?: string | null
          match_title?: string | null
          position?: number
          template_id: string
          title: string
          topic_tags?: string[] | null
        }
        Update: {
          course_id?: string | null
          estimated_hours?: number | null
          id?: string
          justification?: string | null
          match_title?: string | null
          position?: number
          template_id?: string
          title?: string
          topic_tags?: string[] | null
        }
        Relationships: []
      }
      learning_path_templates: {
        Row: {
          course_count: number
          created_at: string
          description: string | null
          difficulty_label: string | null
          estimated_hours: number | null
          id: string
          name: string
          topic_tags: string[] | null
        }
        Insert: {
          course_count?: number
          created_at?: string
          description?: string | null
          difficulty_label?: string | null
          estimated_hours?: number | null
          id: string
          name: string
          topic_tags?: string[] | null
        }
        Update: {
          course_count?: number
          created_at?: string
          description?: string | null
          difficulty_label?: string | null
          estimated_hours?: number | null
          id?: string
          name?: string
          topic_tags?: string[] | null
        }
        Relationships: []
      }
      learning_paths: {
        Row: {
          base_manifest_hash: string | null
          cover_image_url: string | null
          cover_preset: string | null
          created_at: string
          description: string | null
          difficulty_label: string | null
          estimated_hours: number | null
          forked_from: string | null
          id: string
          is_ai_generated: boolean
          is_template: boolean
          name: string
          order_mode: string | null
          progression_mode: string
          updated_at: string
          user_id: string
        }
        Insert: {
          base_manifest_hash?: string | null
          cover_image_url?: string | null
          cover_preset?: string | null
          created_at?: string
          description?: string | null
          difficulty_label?: string | null
          estimated_hours?: number | null
          forked_from?: string | null
          id: string
          is_ai_generated?: boolean
          is_template?: boolean
          name: string
          order_mode?: string | null
          progression_mode?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          base_manifest_hash?: string | null
          cover_image_url?: string | null
          cover_preset?: string | null
          created_at?: string
          description?: string | null
          difficulty_label?: string | null
          estimated_hours?: number | null
          forked_from?: string | null
          id?: string
          is_ai_generated?: boolean
          is_template?: boolean
          name?: string
          order_mode?: string | null
          progression_mode?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          conflict_copy: Json | null
          conflict_source_id: string | null
          content: string
          course_id: string
          created_at: string
          deleted_at: string | null
          id: string
          linked_note_ids: string[]
          soft_deleted: boolean
          tags: string[]
          timestamp_seconds: number | null
          updated_at: string
          user_id: string
          video_id: string
        }
        Insert: {
          conflict_copy?: Json | null
          conflict_source_id?: string | null
          content?: string
          course_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          linked_note_ids?: string[]
          soft_deleted?: boolean
          tags?: string[]
          timestamp_seconds?: number | null
          updated_at?: string
          user_id: string
          video_id: string
        }
        Update: {
          conflict_copy?: Json | null
          conflict_source_id?: string | null
          content?: string
          course_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          linked_note_ids?: string[]
          soft_deleted?: boolean
          tags?: string[]
          timestamp_seconds?: number | null
          updated_at?: string
          user_id?: string
          video_id?: string
        }
        Relationships: []
      }
      notice_acknowledgements: {
        Row: {
          acknowledged_at: string
          document_id: string
          id: string
          ip_hash: string | null
          user_id: string
          version: string
        }
        Insert: {
          acknowledged_at?: string
          document_id: string
          id?: string
          ip_hash?: string | null
          user_id: string
          version: string
        }
        Update: {
          acknowledged_at?: string
          document_id?: string
          id?: string
          ip_hash?: string | null
          user_id?: string
          version?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          achievement_unlocked: boolean
          book_deleted: boolean
          book_imported: boolean
          course_complete: boolean
          highlight_review: boolean
          import_finished: boolean
          knowledge_decay: boolean
          milestone_approaching: boolean
          quiet_hours_enabled: boolean
          quiet_hours_end: string
          quiet_hours_start: string
          recommendation_match: boolean
          review_due: boolean
          srs_due: boolean
          streak_milestone: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          achievement_unlocked?: boolean
          book_deleted?: boolean
          book_imported?: boolean
          course_complete?: boolean
          highlight_review?: boolean
          import_finished?: boolean
          knowledge_decay?: boolean
          milestone_approaching?: boolean
          quiet_hours_enabled?: boolean
          quiet_hours_end?: string
          quiet_hours_start?: string
          recommendation_match?: boolean
          review_due?: boolean
          srs_due?: boolean
          streak_milestone?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          achievement_unlocked?: boolean
          book_deleted?: boolean
          book_imported?: boolean
          course_complete?: boolean
          highlight_review?: boolean
          import_finished?: boolean
          knowledge_decay?: boolean
          milestone_approaching?: boolean
          quiet_hours_enabled?: boolean
          quiet_hours_end?: string
          quiet_hours_start?: string
          recommendation_match?: boolean
          review_due?: boolean
          srs_due?: boolean
          streak_milestone?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_url: string | null
          created_at: string
          dismissed_at: string | null
          id: string
          message: string
          metadata: Json | null
          read_at: string | null
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string
          dismissed_at?: string | null
          id: string
          message: string
          metadata?: Json | null
          read_at?: string | null
          title: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          created_at?: string
          dismissed_at?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          read_at?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      opds_catalogs: {
        Row: {
          auth_username: string | null
          created_at: string
          id: string
          last_synced: string | null
          name: string
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          auth_username?: string | null
          created_at?: string
          id: string
          last_synced?: string | null
          name: string
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          auth_username?: string | null
          created_at?: string
          id?: string
          last_synced?: string | null
          name?: string
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      path_enrollments: {
        Row: {
          completed_at: string | null
          created_at: string
          enrolled_at: string
          id: string
          path_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          enrolled_at?: string
          id: string
          path_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          enrolled_at?: string
          id?: string
          path_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pending_deletions: {
        Row: {
          email: string
          requested_at: string
          user_id: string
        }
        Insert: {
          email: string
          requested_at?: string
          user_id: string
        }
        Update: {
          email?: string
          requested_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quiz_attempts: {
        Row: {
          answers: Json
          completed_at: string
          created_at: string
          id: string
          passed: boolean
          percentage: number
          quiz_id: string
          score: number
          started_at: string
          time_spent: number
          timer_accommodation: string | null
          user_id: string
        }
        Insert: {
          answers?: Json
          completed_at: string
          created_at?: string
          id: string
          passed?: boolean
          percentage?: number
          quiz_id: string
          score?: number
          started_at: string
          time_spent?: number
          timer_accommodation?: string | null
          user_id: string
        }
        Update: {
          answers?: Json
          completed_at?: string
          created_at?: string
          id?: string
          passed?: boolean
          percentage?: number
          quiz_id?: string
          score?: number
          started_at?: string
          time_spent?: number
          timer_accommodation?: string | null
          user_id?: string
        }
        Relationships: []
      }
      quizzes: {
        Row: {
          allow_retakes: boolean
          course_id: string | null
          created_at: string
          description: string
          id: string
          lesson_id: string
          passing_score: number
          question_feedback: Json | null
          questions: Json
          shuffle_answers: boolean
          shuffle_questions: boolean
          time_limit: number | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          allow_retakes?: boolean
          course_id?: string | null
          created_at?: string
          description?: string
          id: string
          lesson_id: string
          passing_score?: number
          question_feedback?: Json | null
          questions?: Json
          shuffle_answers?: boolean
          shuffle_questions?: boolean
          time_limit?: number | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          allow_retakes?: boolean
          course_id?: string | null
          created_at?: string
          description?: string
          id?: string
          lesson_id?: string
          passing_score?: number
          question_feedback?: Json | null
          questions?: Json
          shuffle_answers?: boolean
          shuffle_questions?: boolean
          time_limit?: number | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rate_limit_buckets: {
        Row: {
          bucket_key: string
          count: number
          user_id: string
          window_start: string
        }
        Insert: {
          bucket_key: string
          count?: number
          user_id: string
          window_start: string
        }
        Update: {
          bucket_key?: string
          count?: number
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      reading_queue: {
        Row: {
          added_at: string
          book_id: string
          id: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          added_at?: string
          book_id: string
          id?: string
          position: number
          updated_at?: string
          user_id: string
        }
        Update: {
          added_at?: string
          book_id?: string
          id?: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      retention_audit_log: {
        Row: {
          artefact: string
          completed_at: string | null
          error: string | null
          id: string
          rows_affected: number
          run_id: string
          skipped: boolean
          started_at: string
        }
        Insert: {
          artefact: string
          completed_at?: string | null
          error?: string | null
          id?: string
          rows_affected?: number
          run_id: string
          skipped?: boolean
          started_at: string
        }
        Update: {
          artefact?: string
          completed_at?: string | null
          error?: string | null
          id?: string
          rows_affected?: number
          run_id?: string
          skipped?: boolean
          started_at?: string
        }
        Relationships: []
      }
      review_records: {
        Row: {
          created_at: string
          difficulty: number
          due: string
          elapsed_days: number
          id: string
          lapses: number
          last_review: string | null
          note_id: string
          rating: string
          reps: number
          scheduled_days: number
          stability: number
          state: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          difficulty?: number
          due: string
          elapsed_days?: number
          id?: string
          lapses?: number
          last_review?: string | null
          note_id: string
          rating: string
          reps?: number
          scheduled_days?: number
          stability?: number
          state?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          difficulty?: number
          due?: string
          elapsed_days?: number
          id?: string
          lapses?: number
          last_review?: string | null
          note_id?: string
          rating?: string
          reps?: number
          scheduled_days?: number
          stability?: number
          state?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      shelves: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          is_default: boolean
          name: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          is_default?: boolean
          name: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          is_default?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      study_schedules: {
        Row: {
          course_id: string | null
          created_at: string
          days: string[]
          duration_minutes: number
          enabled: boolean
          id: string
          learning_path_id: string | null
          recurrence: string
          reminder_minutes: number
          start_time: string
          timezone: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          days?: string[]
          duration_minutes?: number
          enabled?: boolean
          id: string
          learning_path_id?: string | null
          recurrence?: string
          reminder_minutes?: number
          start_time: string
          timezone: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          days?: string[]
          duration_minutes?: number
          enabled?: boolean
          id?: string
          learning_path_id?: string | null
          recurrence?: string
          reminder_minutes?: number
          start_time?: string
          timezone?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      study_sessions: {
        Row: {
          breaks: number
          client_request_id: string
          created_at: string
          duration_seconds: number
          id: string
          idle_seconds: number
          interaction_count: number
          started_at: string
          user_id: string
        }
        Insert: {
          breaks?: number
          client_request_id: string
          created_at?: string
          duration_seconds?: number
          id?: string
          idle_seconds?: number
          interaction_count?: number
          started_at: string
          user_id: string
        }
        Update: {
          breaks?: number
          client_request_id?: string
          created_at?: string
          duration_seconds?: number
          id?: string
          idle_seconds?: number
          interaction_count?: number
          started_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_consents: {
        Row: {
          created_at: string
          evidence: Json
          granted_at: string | null
          id: string
          notice_version: string
          purpose: string
          updated_at: string
          user_id: string
          withdrawn_at: string | null
        }
        Insert: {
          created_at?: string
          evidence?: Json
          granted_at?: string | null
          id?: string
          notice_version: string
          purpose: string
          updated_at?: string
          user_id: string
          withdrawn_at?: string | null
        }
        Update: {
          created_at?: string
          evidence?: Json
          granted_at?: string | null
          id?: string
          notice_version?: string
          purpose?: string
          updated_at?: string
          user_id?: string
          withdrawn_at?: string | null
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          settings: Record<string, unknown>
          updated_at: string
          user_id: string
        }
        Insert: {
          settings?: Record<string, unknown>
          updated_at?: string
          user_id: string
        }
        Update: {
          settings?: Record<string, unknown>
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      video_progress: {
        Row: {
          created_at: string
          duration_seconds: number
          id: string
          last_position: number
          updated_at: string
          user_id: string
          video_id: string
          watched_percent: number | null
          watched_seconds: number
        }
        Insert: {
          created_at?: string
          duration_seconds?: number
          id?: string
          last_position?: number
          updated_at?: string
          user_id: string
          video_id: string
          watched_percent?: number | null
          watched_seconds?: number
        }
        Update: {
          created_at?: string
          duration_seconds?: number
          id?: string
          last_position?: number
          updated_at?: string
          user_id?: string
          video_id?: string
          watched_percent?: number | null
          watched_seconds?: number
        }
        Relationships: []
      }
      vocabulary_items: {
        Row: {
          book_id: string
          context: string | null
          created_at: string
          definition: string | null
          highlight_id: string | null
          id: string
          last_reviewed_at: string | null
          mastery_level: number
          note: string | null
          updated_at: string
          user_id: string
          word: string
        }
        Insert: {
          book_id: string
          context?: string | null
          created_at?: string
          definition?: string | null
          highlight_id?: string | null
          id?: string
          last_reviewed_at?: string | null
          mastery_level?: number
          note?: string | null
          updated_at?: string
          user_id: string
          word: string
        }
        Update: {
          book_id?: string
          context?: string | null
          created_at?: string
          definition?: string | null
          highlight_id?: string | null
          id?: string
          last_reviewed_at?: string | null
          mastery_level?: number
          note?: string | null
          updated_at?: string
          user_id?: string
          word?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [functionName: string]: GenericFunction
      _status_rank: { Args: { s: string }; Returns: number }
      compute_reading_streak: {
        Args: {
          p_goal_target?: number
          p_goal_type?: string
          p_timezone?: string
          p_user_id: string
        }
        Returns: {
          current_streak: number
          last_met_date: string
          longest_streak: number
        }[]
      }
      increment_rate_limit: {
        Args: {
          p_bucket_key: string
          p_user_id: string
          p_window_start: string
        }
        Returns: number
      }
      merge_user_settings: {
        Args: { p_patch: Json; p_user_id: string }
        Returns: undefined
      }
      reset_vocabulary_mastery: {
        Args: { p_id: string; p_updated_at: string; p_user_id: string }
        Returns: undefined
      }
      search_similar_notes: {
        Args: { p_limit?: number; p_query_vector: string; p_user_id: string }
        Returns: {
          distance: number
          note_id: string
        }[]
      }
      upsert_book_progress: {
        Args: {
          p_book_id: string
          p_progress: number
          p_updated_at: string
          p_user_id: string
        }
        Returns: undefined
      }
      upsert_content_progress: {
        Args: {
          p_content_id: string
          p_content_type: string
          p_progress_pct: number
          p_status: string
          p_updated_at: string
          p_user_id: string
        }
        Returns: undefined
      }
      upsert_video_progress: {
        Args: {
          p_duration_seconds: number
          p_updated_at: string
          p_user_id: string
          p_video_id: string
          p_watched_seconds: number
        }
        Returns: undefined
      }
      upsert_vocabulary_mastery: {
        Args: {
          p_book_id: string
          p_context?: string
          p_definition?: string
          p_highlight_id?: string
          p_last_reviewed_at?: string
          p_mastery_level: number
          p_note?: string
          p_updated_at: string
          p_user_id: string
          p_vocabulary_item_id: string
          p_word: string
        }
        Returns: undefined
      }
      vault_create_secret: {
        Args: { p_description?: string; p_name: string; p_secret: string }
        Returns: string
      }
      vault_delete_secret_by_name: {
        Args: { p_name: string }
        Returns: boolean
      }
      vault_get_secret_id_by_name: { Args: { p_name: string }; Returns: string }
      vault_read_secret_by_name: { Args: { p_name: string }; Returns: string }
      vault_update_secret_by_name: {
        Args: { p_name: string; p_secret: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
