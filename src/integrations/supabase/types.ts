export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      assignments: {
        Row: {
          conversation_id: string
          created_at: string
          description: string | null
          done_at: string | null
          done_by: string | null
          due_date: string | null
          file_name: string | null
          file_size: number | null
          id: string
          seen_at: string | null
          seen_by: string | null
          status: string
          storage_path: string | null
          teacher_id: string
          title: string
          updated_at: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          description?: string | null
          done_at?: string | null
          done_by?: string | null
          due_date?: string | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          seen_at?: string | null
          seen_by?: string | null
          status?: string
          storage_path?: string | null
          teacher_id: string
          title: string
          updated_at?: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          description?: string | null
          done_at?: string | null
          done_by?: string | null
          due_date?: string | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          seen_at?: string | null
          seen_by?: string | null
          status?: string
          storage_path?: string | null
          teacher_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: []
      }
      availabilities: {
        Row: {
          created_at: string
          end_time: string
          format: string
          id: string
          start_time: string
          teacher_id: string
          updated_at: string
          weekday: number
        }
        Insert: {
          created_at?: string
          end_time: string
          format?: string
          id?: string
          start_time: string
          teacher_id: string
          updated_at?: string
          weekday: number
        }
        Update: {
          created_at?: string
          end_time?: string
          format?: string
          id?: string
          start_time?: string
          teacher_id?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: []
      }
      availability_exceptions: {
        Row: {
          created_at: string
          end_time: string | null
          exception_date: string
          id: string
          reason: string | null
          start_time: string | null
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_time?: string | null
          exception_date: string
          id?: string
          reason?: string | null
          start_time?: string | null
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_time?: string | null
          exception_date?: string
          id?: string
          reason?: string | null
          start_time?: string | null
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          address: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          child_id: string | null
          city: string
          commune: string | null
          completed_at: string | null
          created_at: string
          duration_minutes: number
          format: string
          hold_expires_at: string | null
          id: string
          is_free_session: boolean
          is_recurring: boolean
          message: string | null
          no_show_reported_at: string | null
          no_show_reported_by: string | null
          offer_id: string
          pack_id: string | null
          price_fcfa: number
          recurrence_end_date: string | null
          requester_id: string
          reschedule_used: boolean
          scheduled_at: string
          session_index: number | null
          status: string
          status_reason: string | null
          teacher_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          child_id?: string | null
          city?: string
          commune?: string | null
          completed_at?: string | null
          created_at?: string
          duration_minutes?: number
          format?: string
          hold_expires_at?: string | null
          id?: string
          is_free_session?: boolean
          is_recurring?: boolean
          message?: string | null
          no_show_reported_at?: string | null
          no_show_reported_by?: string | null
          offer_id: string
          pack_id?: string | null
          price_fcfa: number
          recurrence_end_date?: string | null
          requester_id: string
          reschedule_used?: boolean
          scheduled_at: string
          session_index?: number | null
          status?: string
          status_reason?: string | null
          teacher_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          child_id?: string | null
          city?: string
          commune?: string | null
          completed_at?: string | null
          created_at?: string
          duration_minutes?: number
          format?: string
          hold_expires_at?: string | null
          id?: string
          is_free_session?: boolean
          is_recurring?: boolean
          message?: string | null
          no_show_reported_at?: string | null
          no_show_reported_by?: string | null
          offer_id?: string
          pack_id?: string | null
          price_fcfa?: number
          recurrence_end_date?: string | null
          requester_id?: string
          reschedule_used?: boolean
          scheduled_at?: string
          session_index?: number | null
          status?: string
          status_reason?: string | null
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "teacher_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      children: {
        Row: {
          auth_user_id: string | null
          birth_year: number | null
          created_at: string
          first_name: string
          id: string
          notes: string | null
          parent_id: string
          school_level: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          birth_year?: number | null
          created_at?: string
          first_name: string
          id?: string
          notes?: string | null
          parent_id: string
          school_level?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          birth_year?: number | null
          created_at?: string
          first_name?: string
          id?: string
          notes?: string | null
          parent_id?: string
          school_level?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "children_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      conversation_reads: {
        Row: {
          conversation_id: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_reads_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          archived_by_learner: boolean
          archived_by_teacher: boolean
          child_id: string | null
          created_at: string
          id: string
          last_message_at: string | null
          learner_id: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          archived_by_learner?: boolean
          archived_by_teacher?: boolean
          child_id?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          learner_id: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          archived_by_learner?: boolean
          archived_by_teacher?: boolean
          child_id?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          learner_id?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          against_id: string | null
          booking_id: string
          created_at: string
          description: string | null
          id: string
          opened_by: string
          reason: string
          refund_decision_fcfa: number | null
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          against_id?: string | null
          booking_id: string
          created_at?: string
          description?: string | null
          id?: string
          opened_by: string
          reason: string
          refund_decision_fcfa?: number | null
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          against_id?: string | null
          booking_id?: string
          created_at?: string
          description?: string | null
          id?: string
          opened_by?: string
          reason?: string
          refund_decision_fcfa?: number | null
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_preferences: {
        Row: {
          availability_days: number[]
          availability_periods: string[]
          budget_range: string | null
          child_name: string | null
          created_at: string
          filiere: string | null
          for_whom: string | null
          id: string
          learning_style: string | null
          level_other: string | null
          level_slugs: string[]
          objective: string | null
          preferred_communes: string[]
          preferred_format: string | null
          role_context: string
          school_system_other: string | null
          school_systems: string[]
          subject_slugs: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          availability_days?: number[]
          availability_periods?: string[]
          budget_range?: string | null
          child_name?: string | null
          created_at?: string
          filiere?: string | null
          for_whom?: string | null
          id?: string
          learning_style?: string | null
          level_other?: string | null
          level_slugs?: string[]
          objective?: string | null
          preferred_communes?: string[]
          preferred_format?: string | null
          role_context: string
          school_system_other?: string | null
          school_systems?: string[]
          subject_slugs?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          availability_days?: number[]
          availability_periods?: string[]
          budget_range?: string | null
          child_name?: string | null
          created_at?: string
          filiere?: string | null
          for_whom?: string | null
          id?: string
          learning_style?: string | null
          level_other?: string | null
          level_slugs?: string[]
          objective?: string | null
          preferred_communes?: string[]
          preferred_format?: string | null
          role_context?: string
          school_system_other?: string | null
          school_systems?: string[]
          subject_slugs?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      levels: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          sort_order: number
          stage: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          sort_order?: number
          stage?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          stage?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          attachment_name: string | null
          attachment_path: string | null
          attachment_size: number | null
          body: string | null
          conversation_id: string
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_size?: number | null
          body?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_size?: number | null
          body?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      offer_levels: {
        Row: {
          level_id: string
          offer_id: string
        }
        Insert: {
          level_id: string
          offer_id: string
        }
        Update: {
          level_id?: string
          offer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_levels_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_levels_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "teacher_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      pack_types: {
        Row: {
          created_at: string
          fee_rate: number
          free_sessions: number
          is_active: boolean
          is_pack: boolean
          name: string
          once_per_family: boolean
          sessions_total: number
          slug: string
          sort_order: number
          tagline: string | null
          validity_days: number
        }
        Insert: {
          created_at?: string
          fee_rate: number
          free_sessions?: number
          is_active?: boolean
          is_pack?: boolean
          name: string
          once_per_family?: boolean
          sessions_total: number
          slug: string
          sort_order?: number
          tagline?: string | null
          validity_days: number
        }
        Update: {
          created_at?: string
          fee_rate?: number
          free_sessions?: number
          is_active?: boolean
          is_pack?: boolean
          name?: string
          once_per_family?: boolean
          sessions_total?: number
          slug?: string
          sort_order?: number
          tagline?: string | null
          validity_days?: number
        }
        Relationships: []
      }
      packs: {
        Row: {
          address: string | null
          buyer_id: string
          child_id: string | null
          city: string
          commune: string | null
          created_at: string
          duration_minutes: number
          expires_at: string | null
          format: string
          free_sessions: number
          hold_expires_at: string | null
          id: string
          offer_id: string
          pack_slug: string
          paid_sessions: number
          platform_fee_fcfa: number
          purchased_at: string | null
          sessions_total: number
          sessions_used: number
          status: string
          teacher_amount_fcfa: number
          teacher_id: string
          teacher_rate_fcfa: number
          total_fcfa: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          buyer_id: string
          child_id?: string | null
          city?: string
          commune?: string | null
          created_at?: string
          duration_minutes: number
          expires_at?: string | null
          format?: string
          free_sessions?: number
          hold_expires_at?: string | null
          id?: string
          offer_id: string
          pack_slug: string
          paid_sessions: number
          platform_fee_fcfa: number
          purchased_at?: string | null
          sessions_total: number
          sessions_used?: number
          status?: string
          teacher_amount_fcfa: number
          teacher_id: string
          teacher_rate_fcfa: number
          total_fcfa: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          buyer_id?: string
          child_id?: string | null
          city?: string
          commune?: string | null
          created_at?: string
          duration_minutes?: number
          expires_at?: string | null
          format?: string
          free_sessions?: number
          hold_expires_at?: string | null
          id?: string
          offer_id?: string
          pack_slug?: string
          paid_sessions?: number
          platform_fee_fcfa?: number
          purchased_at?: string | null
          sessions_total?: number
          sessions_used?: number
          status?: string
          teacher_amount_fcfa?: number
          teacher_id?: string
          teacher_rate_fcfa?: number
          total_fcfa?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "packs_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packs_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "teacher_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packs_pack_slug_fkey"
            columns: ["pack_slug"]
            isOneToOne: false
            referencedRelation: "pack_types"
            referencedColumns: ["slug"]
          },
        ]
      }
      payments: {
        Row: {
          amount_fcfa: number
          cancelled_at: string | null
          created_at: string
          id: string
          method: string
          pack_id: string | null
          paid_at: string | null
          payer_id: string
          platform_fee_fcfa: number
          provider: string
          provider_notified_at: string | null
          provider_redirect_url: string | null
          provider_reference: string | null
          provider_request_id: string | null
          provider_status: string | null
          provider_transaction_id: string | null
          refund_fcfa: number
          refund_rate: number | null
          refunded_at: string | null
          status: string
          teacher_amount_fcfa: number
          teacher_id: string
          updated_at: string
          wallet_used_fcfa: number
        }
        Insert: {
          amount_fcfa: number
          cancelled_at?: string | null
          created_at?: string
          id?: string
          method?: string
          pack_id?: string | null
          paid_at?: string | null
          payer_id: string
          platform_fee_fcfa?: number
          provider?: string
          provider_notified_at?: string | null
          provider_redirect_url?: string | null
          provider_reference?: string | null
          provider_request_id?: string | null
          provider_status?: string | null
          provider_transaction_id?: string | null
          refund_fcfa?: number
          refund_rate?: number | null
          refunded_at?: string | null
          status?: string
          teacher_amount_fcfa?: number
          teacher_id: string
          updated_at?: string
          wallet_used_fcfa?: number
        }
        Update: {
          amount_fcfa?: number
          cancelled_at?: string | null
          created_at?: string
          id?: string
          method?: string
          pack_id?: string | null
          paid_at?: string | null
          payer_id?: string
          platform_fee_fcfa?: number
          provider?: string
          provider_notified_at?: string | null
          provider_redirect_url?: string | null
          provider_reference?: string | null
          provider_request_id?: string | null
          provider_status?: string | null
          provider_transaction_id?: string | null
          refund_fcfa?: number
          refund_rate?: number | null
          refunded_at?: string | null
          status?: string
          teacher_amount_fcfa?: number
          teacher_id?: string
          updated_at?: string
          wallet_used_fcfa?: number
        }
        Relationships: [
          {
            foreignKeyName: "payments_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          created_at: string
          description: string | null
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          city: string
          commune: string | null
          created_at: string
          display_name: string
          id: string
          onboarding_completed_at: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          city?: string
          commune?: string | null
          created_at?: string
          display_name: string
          id?: string
          onboarding_completed_at?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          city?: string
          commune?: string | null
          created_at?: string
          display_name?: string
          id?: string
          onboarding_completed_at?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          author_id: string
          booking_id: string
          comment: string | null
          created_at: string
          id: string
          rating: number
          status: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          booking_id: string
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          status?: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          booking_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          status?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      session_reports: {
        Row: {
          attendance: string
          booking_id: string
          child_id: string | null
          content_note: string
          created_at: string
          engagement_rating: number
          homework_done: string | null
          id: string
          learner_id: string
          next_steps: string | null
          progress_level: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          attendance: string
          booking_id: string
          child_id?: string | null
          content_note: string
          created_at?: string
          engagement_rating: number
          homework_done?: string | null
          id?: string
          learner_id: string
          next_steps?: string | null
          progress_level: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          attendance?: string
          booking_id?: string
          child_id?: string | null
          content_note?: string
          created_at?: string
          engagement_rating?: number
          homework_done?: string | null
          id?: string
          learner_id?: string
          next_steps?: string | null
          progress_level?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_reports_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_reports_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          category_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "subjects_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_documents: {
        Row: {
          created_at: string
          file_name: string | null
          id: string
          kind: string
          note: string | null
          storage_path: string
          teacher_id: string
          updated_at: string
          verification_status: string
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          id?: string
          kind?: string
          note?: string | null
          storage_path: string
          teacher_id: string
          updated_at?: string
          verification_status?: string
        }
        Update: {
          created_at?: string
          file_name?: string | null
          id?: string
          kind?: string
          note?: string | null
          storage_path?: string
          teacher_id?: string
          updated_at?: string
          verification_status?: string
        }
        Relationships: []
      }
      teacher_earnings: {
        Row: {
          amount_fcfa: number
          booking_id: string | null
          created_at: string
          id: string
          pack_id: string
          paid_at: string | null
          status: string
          teacher_id: string
          updated_at: string
          validated_at: string | null
          withdrawal_request_id: string | null
        }
        Insert: {
          amount_fcfa: number
          booking_id?: string | null
          created_at?: string
          id?: string
          pack_id: string
          paid_at?: string | null
          status?: string
          teacher_id: string
          updated_at?: string
          validated_at?: string | null
          withdrawal_request_id?: string | null
        }
        Update: {
          amount_fcfa?: number
          booking_id?: string | null
          created_at?: string
          id?: string
          pack_id?: string
          paid_at?: string | null
          status?: string
          teacher_id?: string
          updated_at?: string
          validated_at?: string | null
          withdrawal_request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_earnings_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_earnings_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_earnings_withdrawal_request_id_fkey"
            columns: ["withdrawal_request_id"]
            isOneToOne: false
            referencedRelation: "wallet_withdrawal_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_educations: {
        Row: {
          created_at: string
          degree: string
          end_year: number | null
          field: string | null
          honors: string | null
          id: string
          school: string
          sort_order: number
          start_year: number | null
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          degree: string
          end_year?: number | null
          field?: string | null
          honors?: string | null
          id?: string
          school: string
          sort_order?: number
          start_year?: number | null
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          degree?: string
          end_year?: number | null
          field?: string | null
          honors?: string | null
          id?: string
          school?: string
          sort_order?: number
          start_year?: number | null
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      teacher_experiences: {
        Row: {
          created_at: string
          description: string | null
          end_year: number | null
          id: string
          is_current: boolean
          organization: string | null
          role_title: string
          sort_order: number
          start_year: number | null
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_year?: number | null
          id?: string
          is_current?: boolean
          organization?: string | null
          role_title: string
          sort_order?: number
          start_year?: number | null
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_year?: number | null
          id?: string
          is_current?: boolean
          organization?: string | null
          role_title?: string
          sort_order?: number
          start_year?: number | null
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      teacher_grades: {
        Row: {
          achieved_at: string
          grade: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          achieved_at?: string
          grade?: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          achieved_at?: string
          grade?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      teacher_offers: {
        Row: {
          city: string
          communes: string[]
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          offers_home: boolean
          offers_online: boolean
          price_fcfa: number
          status: string
          subject_id: string
          teacher_id: string
          title: string
          updated_at: string
        }
        Insert: {
          city?: string
          communes?: string[]
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          offers_home?: boolean
          offers_online?: boolean
          price_fcfa: number
          status?: string
          subject_id: string
          teacher_id: string
          title: string
          updated_at?: string
        }
        Update: {
          city?: string
          communes?: string[]
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          offers_home?: boolean
          offers_online?: boolean
          price_fcfa?: number
          status?: string
          subject_id?: string
          teacher_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_offers_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_photos: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          sort_order: number
          storage_path: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          sort_order?: number
          storage_path: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          sort_order?: number
          storage_path?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      teacher_profiles: {
        Row: {
          bio: string | null
          created_at: string
          headline: string | null
          id: string
          identity_verified: boolean
          intro_video_url: string | null
          languages: string[]
          main_degree: string | null
          offers_home: boolean
          offers_online: boolean
          qualifications_verified: boolean
          teaching_method: string | null
          updated_at: string
          user_id: string
          verification_decided_at: string | null
          verification_note: string | null
          verification_status: string
          verification_submitted_at: string | null
          years_experience: number | null
          zones: string[]
        }
        Insert: {
          bio?: string | null
          created_at?: string
          headline?: string | null
          id?: string
          identity_verified?: boolean
          intro_video_url?: string | null
          languages?: string[]
          main_degree?: string | null
          offers_home?: boolean
          offers_online?: boolean
          qualifications_verified?: boolean
          teaching_method?: string | null
          updated_at?: string
          user_id: string
          verification_decided_at?: string | null
          verification_note?: string | null
          verification_status?: string
          verification_submitted_at?: string | null
          years_experience?: number | null
          zones?: string[]
        }
        Update: {
          bio?: string | null
          created_at?: string
          headline?: string | null
          id?: string
          identity_verified?: boolean
          intro_video_url?: string | null
          languages?: string[]
          main_degree?: string | null
          offers_home?: boolean
          offers_online?: boolean
          qualifications_verified?: boolean
          teaching_method?: string | null
          updated_at?: string
          user_id?: string
          verification_decided_at?: string | null
          verification_note?: string | null
          verification_status?: string
          verification_submitted_at?: string | null
          years_experience?: number | null
          zones?: string[]
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_payout_contacts: {
        Row: {
          created_at: string
          id: string
          jeko_contact_id: string
          method: string
          phone: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          jeko_contact_id: string
          method: string
          phone: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          jeko_contact_id?: string
          method?: string
          phone?: string
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount_fcfa: number
          balance_after: number
          booking_id: string | null
          created_at: string
          id: string
          kind: string
          payment_id: string | null
          reason: string
          type: string
          user_id: string
          withdrawal_request_id: string | null
        }
        Insert: {
          amount_fcfa: number
          balance_after: number
          booking_id?: string | null
          created_at?: string
          id?: string
          kind: string
          payment_id?: string | null
          reason: string
          type: string
          user_id: string
          withdrawal_request_id?: string | null
        }
        Update: {
          amount_fcfa?: number
          balance_after?: number
          booking_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          payment_id?: string | null
          reason?: string
          type?: string
          user_id?: string
          withdrawal_request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_withdrawal_request_id_fkey"
            columns: ["withdrawal_request_id"]
            isOneToOne: false
            referencedRelation: "wallet_withdrawal_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_withdrawal_requests: {
        Row: {
          admin_note: string | null
          amount_fcfa: number
          error_message: string | null
          fee_fcfa: number
          id: string
          is_monthly: boolean
          jeko_contact_id: string | null
          jeko_fees_fcfa: number
          jeko_reference: string | null
          jeko_transfer_id: string | null
          method: string
          phone: string
          processed_at: string | null
          processed_by: string | null
          processing_started_at: string | null
          requested_at: string
          status: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount_fcfa: number
          error_message?: string | null
          fee_fcfa?: number
          id?: string
          is_monthly?: boolean
          jeko_contact_id?: string | null
          jeko_fees_fcfa?: number
          jeko_reference?: string | null
          jeko_transfer_id?: string | null
          method: string
          phone: string
          processed_at?: string | null
          processed_by?: string | null
          processing_started_at?: string | null
          requested_at?: string
          status?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount_fcfa?: number
          error_message?: string | null
          fee_fcfa?: number
          id?: string
          is_monthly?: boolean
          jeko_contact_id?: string | null
          jeko_fees_fcfa?: number
          jeko_reference?: string | null
          jeko_transfer_id?: string | null
          method?: string
          phone?: string
          processed_at?: string | null
          processed_by?: string | null
          processing_started_at?: string | null
          requested_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance_fcfa: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance_fcfa?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance_fcfa?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_pack: {
        Args: { p_pack_id: string }
        Returns: {
          address: string | null
          buyer_id: string
          child_id: string | null
          city: string
          commune: string | null
          created_at: string
          duration_minutes: number
          expires_at: string | null
          format: string
          free_sessions: number
          hold_expires_at: string | null
          id: string
          offer_id: string
          pack_slug: string
          paid_sessions: number
          platform_fee_fcfa: number
          purchased_at: string | null
          sessions_total: number
          sessions_used: number
          status: string
          teacher_amount_fcfa: number
          teacher_id: string
          teacher_rate_fcfa: number
          total_fcfa: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "packs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_can_read_conversation: {
        Args: { p_conversation_id: string; p_user: string }
        Returns: boolean
      }
      admin_list_teachers: {
        Args: never
        Returns: {
          city: string
          commune: string
          created_at: string
          display_name: string
          documents_total: number
          headline: string
          identity_verified: boolean
          offers_published: number
          offers_total: number
          phone: string
          qualifications_verified: boolean
          teacher_id: string
          verification_decided_at: string
          verification_note: string
          verification_status: string
          verification_submitted_at: string
          years_experience: number
        }[]
      }
      admin_list_wallet_withdrawals: {
        Args: { p_status?: string }
        Returns: {
          admin_note: string
          amount_fcfa: number
          display_name: string
          error_message: string
          id: string
          method: string
          phone: string
          processed_at: string
          requested_at: string
          status: string
          user_id: string
        }[]
      }
      admin_moderate_offer: {
        Args: { p_offer_id: string; p_reason?: string; p_status: string }
        Returns: {
          city: string
          communes: string[]
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          offers_home: boolean
          offers_online: boolean
          price_fcfa: number
          status: string
          subject_id: string
          teacher_id: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "teacher_offers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_process_wallet_withdrawal: {
        Args: { p_admin_note?: string; p_request_id: string; p_status: string }
        Returns: {
          admin_note: string | null
          amount_fcfa: number
          error_message: string | null
          fee_fcfa: number
          id: string
          is_monthly: boolean
          jeko_contact_id: string | null
          jeko_fees_fcfa: number
          jeko_reference: string | null
          jeko_transfer_id: string | null
          method: string
          phone: string
          processed_at: string | null
          processed_by: string | null
          processing_started_at: string | null
          requested_at: string
          status: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "wallet_withdrawal_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_read_dispute_conversation: {
        Args: { p_dispute_id: string }
        Returns: Json
      }
      admin_resolve_dispute: {
        Args: {
          p_dispute_id: string
          p_refund_fcfa?: number
          p_reschedule_to?: string
          p_resolution?: string
          p_status: string
        }
        Returns: {
          against_id: string | null
          booking_id: string
          created_at: string
          description: string | null
          id: string
          opened_by: string
          reason: string
          refund_decision_fcfa: number | null
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "disputes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_review_teacher_document: {
        Args: { p_document_id: string; p_note?: string; p_status: string }
        Returns: {
          created_at: string
          file_name: string | null
          id: string
          kind: string
          note: string | null
          storage_path: string
          teacher_id: string
          updated_at: string
          verification_status: string
        }
        SetofOptions: {
          from: "*"
          to: "teacher_documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_set_teacher_verification:
        | {
            Args: {
              p_identity_verified: boolean
              p_qualifications_verified: boolean
              p_teacher_id: string
              p_verification_status: string
            }
            Returns: {
              bio: string | null
              created_at: string
              headline: string | null
              id: string
              identity_verified: boolean
              intro_video_url: string | null
              languages: string[]
              main_degree: string | null
              offers_home: boolean
              offers_online: boolean
              qualifications_verified: boolean
              teaching_method: string | null
              updated_at: string
              user_id: string
              verification_decided_at: string | null
              verification_note: string | null
              verification_status: string
              verification_submitted_at: string | null
              years_experience: number | null
              zones: string[]
            }
            SetofOptions: {
              from: "*"
              to: "teacher_profiles"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              p_identity_verified: boolean
              p_note?: string
              p_qualifications_verified: boolean
              p_teacher_id: string
              p_verification_status: string
            }
            Returns: {
              bio: string | null
              created_at: string
              headline: string | null
              id: string
              identity_verified: boolean
              intro_video_url: string | null
              languages: string[]
              main_degree: string | null
              offers_home: boolean
              offers_online: boolean
              qualifications_verified: boolean
              teaching_method: string | null
              updated_at: string
              user_id: string
              verification_decided_at: string | null
              verification_note: string | null
              verification_status: string
              verification_submitted_at: string | null
              years_experience: number | null
              zones: string[]
            }
            SetofOptions: {
              from: "*"
              to: "teacher_profiles"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      cancel_pack_payment: {
        Args: { p_pack_id: string; p_reason?: string }
        Returns: {
          address: string | null
          buyer_id: string
          child_id: string | null
          city: string
          commune: string | null
          created_at: string
          duration_minutes: number
          expires_at: string | null
          format: string
          free_sessions: number
          hold_expires_at: string | null
          id: string
          offer_id: string
          pack_slug: string
          paid_sessions: number
          platform_fee_fcfa: number
          purchased_at: string | null
          sessions_total: number
          sessions_used: number
          status: string
          teacher_amount_fcfa: number
          teacher_id: string
          teacher_rate_fcfa: number
          total_fcfa: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "packs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_session: {
        Args: { p_booking_id: string; p_reason?: string }
        Returns: {
          address: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          child_id: string | null
          city: string
          commune: string | null
          completed_at: string | null
          created_at: string
          duration_minutes: number
          format: string
          hold_expires_at: string | null
          id: string
          is_free_session: boolean
          is_recurring: boolean
          message: string | null
          no_show_reported_at: string | null
          no_show_reported_by: string | null
          offer_id: string
          pack_id: string | null
          price_fcfa: number
          recurrence_end_date: string | null
          requester_id: string
          reschedule_used: boolean
          scheduled_at: string
          session_index: number | null
          status: string
          status_reason: string | null
          teacher_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_booking: {
        Args: { p_booking_id: string }
        Returns: {
          address: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          child_id: string | null
          city: string
          commune: string | null
          completed_at: string | null
          created_at: string
          duration_minutes: number
          format: string
          hold_expires_at: string | null
          id: string
          is_free_session: boolean
          is_recurring: boolean
          message: string | null
          no_show_reported_at: string | null
          no_show_reported_by: string | null
          offer_id: string
          pack_id: string | null
          price_fcfa: number
          recurrence_end_date: string | null
          requester_id: string
          reschedule_used: boolean
          scheduled_at: string
          session_index: number | null
          status: string
          status_reason: string | null
          teacher_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_withdrawal_payout: {
        Args: {
          p_fees_fcfa?: number
          p_jeko_transfer_id: string
          p_withdrawal_id: string
        }
        Returns: {
          admin_note: string | null
          amount_fcfa: number
          error_message: string | null
          fee_fcfa: number
          id: string
          is_monthly: boolean
          jeko_contact_id: string | null
          jeko_fees_fcfa: number
          jeko_reference: string | null
          jeko_transfer_id: string | null
          method: string
          phone: string
          processed_at: string | null
          processed_by: string | null
          processing_started_at: string | null
          requested_at: string
          status: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "wallet_withdrawal_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      conversation_role: {
        Args: { p_conversation_id: string; p_user: string }
        Returns: string
      }
      create_pack_payment: {
        Args: { p_pack_id: string; p_wallet_amount_fcfa?: number }
        Returns: {
          amount_fcfa: number
          cancelled_at: string | null
          created_at: string
          id: string
          method: string
          pack_id: string | null
          paid_at: string | null
          payer_id: string
          platform_fee_fcfa: number
          provider: string
          provider_notified_at: string | null
          provider_redirect_url: string | null
          provider_reference: string | null
          provider_request_id: string | null
          provider_status: string | null
          provider_transaction_id: string | null
          refund_fcfa: number
          refund_rate: number | null
          refunded_at: string | null
          status: string
          teacher_amount_fcfa: number
          teacher_id: string
          updated_at: string
          wallet_used_fcfa: number
        }
        SetofOptions: {
          from: "*"
          to: "payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      credit_wallet: {
        Args: {
          p_amount_fcfa: number
          p_booking_id?: string
          p_kind: string
          p_payment_id?: string
          p_reason: string
          p_user_id: string
        }
        Returns: string
      }
      debit_wallet: {
        Args: {
          p_amount_fcfa: number
          p_booking_id?: string
          p_kind: string
          p_payment_id?: string
          p_reason: string
          p_user_id: string
        }
        Returns: string
      }
      ensure_conversation: {
        Args: {
          p_child_id?: string
          p_learner_id?: string
          p_teacher_id: string
        }
        Returns: {
          archived_by_learner: boolean
          archived_by_teacher: boolean
          child_id: string | null
          created_at: string
          id: string
          last_message_at: string | null
          learner_id: string
          teacher_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "conversations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      expire_stale_pack_holds: { Args: never; Returns: undefined }
      fail_withdrawal_payout: {
        Args: { p_error_message: string; p_withdrawal_id: string }
        Returns: {
          admin_note: string | null
          amount_fcfa: number
          error_message: string | null
          fee_fcfa: number
          id: string
          is_monthly: boolean
          jeko_contact_id: string | null
          jeko_fees_fcfa: number
          jeko_reference: string | null
          jeko_transfer_id: string | null
          method: string
          phone: string
          processed_at: string | null
          processed_by: string | null
          processing_started_at: string | null
          requested_at: string
          status: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "wallet_withdrawal_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_teacher_busy_slots: {
        Args: { p_from: string; p_teacher_id: string; p_to: string }
        Returns: {
          duration_minutes: number
          scheduled_at: string
        }[]
      }
      get_teacher_full_public: { Args: { p_teacher_id: string }; Returns: Json }
      get_teacher_public: {
        Args: { p_teacher_id: string }
        Returns: {
          avatar_url: string
          bio: string
          city: string
          commune: string
          display_name: string
          headline: string
          identity_verified: boolean
          qualifications_verified: boolean
          teacher_id: string
          years_experience: number
          zones: string[]
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_profile_counterpart: {
        Args: { p_other: string; p_user: string }
        Returns: boolean
      }
      jeko_save_pack_payment_request: {
        Args: {
          p_method: string
          p_pack_id: string
          p_provider_reference: string
        }
        Returns: {
          amount_fcfa: number
          cancelled_at: string | null
          created_at: string
          id: string
          method: string
          pack_id: string | null
          paid_at: string | null
          payer_id: string
          platform_fee_fcfa: number
          provider: string
          provider_notified_at: string | null
          provider_redirect_url: string | null
          provider_reference: string | null
          provider_request_id: string | null
          provider_status: string | null
          provider_transaction_id: string | null
          refund_fcfa: number
          refund_rate: number | null
          refunded_at: string | null
          status: string
          teacher_amount_fcfa: number
          teacher_id: string
          updated_at: string
          wallet_used_fcfa: number
        }
        SetofOptions: {
          from: "*"
          to: "payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mark_conversation_read: {
        Args: { p_conversation_id: string }
        Returns: undefined
      }
      mark_pack_payment_paid: {
        Args: { p_method?: string; p_pack_id: string }
        Returns: {
          amount_fcfa: number
          cancelled_at: string | null
          created_at: string
          id: string
          method: string
          pack_id: string | null
          paid_at: string | null
          payer_id: string
          platform_fee_fcfa: number
          provider: string
          provider_notified_at: string | null
          provider_redirect_url: string | null
          provider_reference: string | null
          provider_request_id: string | null
          provider_status: string | null
          provider_transaction_id: string | null
          refund_fcfa: number
          refund_rate: number | null
          refunded_at: string | null
          status: string
          teacher_amount_fcfa: number
          teacher_id: string
          updated_at: string
          wallet_used_fcfa: number
        }
        SetofOptions: {
          from: "*"
          to: "payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mark_withdrawal_processing: {
        Args: {
          p_jeko_contact_id: string
          p_jeko_reference: string
          p_jeko_transfer_id: string
          p_withdrawal_id: string
        }
        Returns: {
          admin_note: string | null
          amount_fcfa: number
          error_message: string | null
          fee_fcfa: number
          id: string
          is_monthly: boolean
          jeko_contact_id: string | null
          jeko_fees_fcfa: number
          jeko_reference: string | null
          jeko_transfer_id: string | null
          method: string
          phone: string
          processed_at: string | null
          processed_by: string | null
          processing_started_at: string | null
          requested_at: string
          status: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "wallet_withdrawal_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      pair_has_booking: {
        Args: { p_child_id: string; p_learner_id: string; p_teacher_id: string }
        Returns: boolean
      }
      process_monthly_payouts: { Args: never; Returns: number }
      purchase_pack: {
        Args: {
          p_address?: string
          p_child_id?: string
          p_commune?: string
          p_format?: string
          p_offer_id: string
          p_pack_slug: string
        }
        Returns: {
          address: string | null
          buyer_id: string
          child_id: string | null
          city: string
          commune: string | null
          created_at: string
          duration_minutes: number
          expires_at: string | null
          format: string
          free_sessions: number
          hold_expires_at: string | null
          id: string
          offer_id: string
          pack_slug: string
          paid_sessions: number
          platform_fee_fcfa: number
          purchased_at: string | null
          sessions_total: number
          sessions_used: number
          status: string
          teacher_amount_fcfa: number
          teacher_id: string
          teacher_rate_fcfa: number
          total_fcfa: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "packs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      quote_pack: {
        Args: { p_offer_id: string; p_pack_slug: string }
        Returns: Json
      }
      refresh_teacher_grade: { Args: { p_teacher_id: string }; Returns: string }
      report_parent_no_show: {
        Args: { p_booking_id: string }
        Returns: {
          address: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          child_id: string | null
          city: string
          commune: string | null
          completed_at: string | null
          created_at: string
          duration_minutes: number
          format: string
          hold_expires_at: string | null
          id: string
          is_free_session: boolean
          is_recurring: boolean
          message: string | null
          no_show_reported_at: string | null
          no_show_reported_by: string | null
          offer_id: string
          pack_id: string | null
          price_fcfa: number
          recurrence_end_date: string | null
          requester_id: string
          reschedule_used: boolean
          scheduled_at: string
          session_index: number | null
          status: string
          status_reason: string | null
          teacher_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      report_teacher_no_show: {
        Args: { p_booking_id: string }
        Returns: {
          address: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          child_id: string | null
          city: string
          commune: string | null
          completed_at: string | null
          created_at: string
          duration_minutes: number
          format: string
          hold_expires_at: string | null
          id: string
          is_free_session: boolean
          is_recurring: boolean
          message: string | null
          no_show_reported_at: string | null
          no_show_reported_by: string | null
          offer_id: string
          pack_id: string | null
          price_fcfa: number
          recurrence_end_date: string | null
          requester_id: string
          reschedule_used: boolean
          scheduled_at: string
          session_index: number | null
          status: string
          status_reason: string | null
          teacher_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      request_wallet_withdrawal: {
        Args: { p_amount_fcfa: number; p_method: string; p_phone: string }
        Returns: {
          admin_note: string | null
          amount_fcfa: number
          error_message: string | null
          fee_fcfa: number
          id: string
          is_monthly: boolean
          jeko_contact_id: string | null
          jeko_fees_fcfa: number
          jeko_reference: string | null
          jeko_transfer_id: string | null
          method: string
          phone: string
          processed_at: string | null
          processed_by: string | null
          processing_started_at: string | null
          requested_at: string
          status: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "wallet_withdrawal_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reschedule_session: {
        Args: { p_booking_id: string; p_new_scheduled_at: string }
        Returns: {
          address: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          child_id: string | null
          city: string
          commune: string | null
          completed_at: string | null
          created_at: string
          duration_minutes: number
          format: string
          hold_expires_at: string | null
          id: string
          is_free_session: boolean
          is_recurring: boolean
          message: string | null
          no_show_reported_at: string | null
          no_show_reported_by: string | null
          offer_id: string
          pack_id: string | null
          price_fcfa: number
          recurrence_end_date: string | null
          requester_id: string
          reschedule_used: boolean
          scheduled_at: string
          session_index: number | null
          status: string
          status_reason: string | null
          teacher_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reserve_earnings_for_withdrawal: {
        Args: { p_free: boolean; p_target_fcfa: number; p_teacher_id: string }
        Returns: Json
      }
      respond_booking_request: {
        Args: { p_accept: boolean; p_booking_id: string; p_reason?: string }
        Returns: undefined
      }
      retry_withdrawal_payout: {
        Args: { p_withdrawal_id: string }
        Returns: {
          admin_note: string | null
          amount_fcfa: number
          error_message: string | null
          fee_fcfa: number
          id: string
          is_monthly: boolean
          jeko_contact_id: string | null
          jeko_fees_fcfa: number
          jeko_reference: string | null
          jeko_transfer_id: string | null
          method: string
          phone: string
          processed_at: string | null
          processed_by: string | null
          processing_started_at: string | null
          requested_at: string
          status: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "wallet_withdrawal_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      schedule_pack_session: {
        Args: {
          p_address?: string
          p_commune?: string
          p_format?: string
          p_message?: string
          p_pack_id: string
          p_scheduled_at: string
        }
        Returns: {
          address: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          child_id: string | null
          city: string
          commune: string | null
          completed_at: string | null
          created_at: string
          duration_minutes: number
          format: string
          hold_expires_at: string | null
          id: string
          is_free_session: boolean
          is_recurring: boolean
          message: string | null
          no_show_reported_at: string | null
          no_show_reported_by: string | null
          offer_id: string
          pack_id: string | null
          price_fcfa: number
          recurrence_end_date: string | null
          requester_id: string
          reschedule_used: boolean
          scheduled_at: string
          session_index: number | null
          status: string
          status_reason: string | null
          teacher_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      search_teachers: {
        Args: {
          p_city?: string
          p_commune?: string
          p_format?: string
          p_level_slug?: string
          p_limit?: number
          p_max_price?: number
          p_min_price?: number
          p_offset?: number
          p_query?: string
          p_subject_slug?: string
          p_weekday?: number
        }
        Returns: {
          avatar_url: string
          bio: string
          city: string
          commune: string
          display_name: string
          grade: string
          headline: string
          identity_verified: boolean
          lessons_count: number
          min_price_fcfa: number
          offers_home: boolean
          offers_online: boolean
          qualifications_verified: boolean
          rate_cap_fcfa: number
          rating_avg: number
          rating_count: number
          sample_offer_id: string
          students_count: number
          subjects: string[]
          teacher_id: string
          teaching_method: string
          years_experience: number
        }[]
      }
      set_assignment_status: {
        Args: { p_assignment_id: string; p_status: string }
        Returns: {
          conversation_id: string
          created_at: string
          description: string | null
          done_at: string | null
          done_by: string | null
          due_date: string | null
          file_name: string | null
          file_size: number | null
          id: string
          seen_at: string | null
          seen_by: string | null
          status: string
          storage_path: string | null
          teacher_id: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "assignments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_conversation_archived: {
        Args: { p_archived: boolean; p_conversation_id: string }
        Returns: {
          archived_by_learner: boolean
          archived_by_teacher: boolean
          child_id: string | null
          created_at: string
          id: string
          last_message_at: string | null
          learner_id: string
          teacher_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "conversations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_teacher_verification: {
        Args: never
        Returns: {
          bio: string | null
          created_at: string
          headline: string | null
          id: string
          identity_verified: boolean
          intro_video_url: string | null
          languages: string[]
          main_degree: string | null
          offers_home: boolean
          offers_online: boolean
          qualifications_verified: boolean
          teaching_method: string | null
          updated_at: string
          user_id: string
          verification_decided_at: string | null
          verification_note: string | null
          verification_status: string
          verification_submitted_at: string | null
          years_experience: number | null
          zones: string[]
        }
        SetofOptions: {
          from: "*"
          to: "teacher_profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      teacher_earnings_summary: { Args: never; Returns: Json }
      teacher_rate_cap: { Args: { p_teacher_id: string }; Returns: number }
      teacher_recent_assignments: { Args: { p_limit?: number }; Returns: Json }
      teacher_student_profile: {
        Args: { p_child_id?: string; p_learner_id: string }
        Returns: Json
      }
      try_validate_session_earning: {
        Args: { p_booking_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "parent" | "student" | "teacher" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["parent", "student", "teacher", "admin"],
    },
  },
} as const
