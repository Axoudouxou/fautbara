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
          child_id: string | null
          city: string
          commune: string | null
          created_at: string
          duration_minutes: number
          format: string
          id: string
          is_recurring: boolean
          message: string | null
          offer_id: string
          price_fcfa: number
          recurrence_end_date: string | null
          requester_id: string
          scheduled_at: string
          status: string
          status_reason: string | null
          teacher_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          child_id?: string | null
          city?: string
          commune?: string | null
          created_at?: string
          duration_minutes?: number
          format?: string
          id?: string
          is_recurring?: boolean
          message?: string | null
          offer_id: string
          price_fcfa: number
          recurrence_end_date?: string | null
          requester_id: string
          scheduled_at: string
          status?: string
          status_reason?: string | null
          teacher_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          child_id?: string | null
          city?: string
          commune?: string | null
          created_at?: string
          duration_minutes?: number
          format?: string
          id?: string
          is_recurring?: boolean
          message?: string | null
          offer_id?: string
          price_fcfa?: number
          recurrence_end_date?: string | null
          requester_id?: string
          scheduled_at?: string
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
      payments: {
        Row: {
          amount_fcfa: number
          booking_id: string
          cancelled_at: string | null
          commission_fcfa: number
          commission_rate: number
          created_at: string
          escrow_release_at: string | null
          escrow_status: string
          id: string
          method: string
          paid_at: string | null
          payer_id: string
          provider: string
          status: string
          teacher_id: string
          teacher_payout_fcfa: number
          updated_at: string
        }
        Insert: {
          amount_fcfa: number
          booking_id: string
          cancelled_at?: string | null
          commission_fcfa: number
          commission_rate: number
          created_at?: string
          escrow_release_at?: string | null
          escrow_status?: string
          id?: string
          method?: string
          paid_at?: string | null
          payer_id: string
          provider?: string
          status?: string
          teacher_id: string
          teacher_payout_fcfa: number
          updated_at?: string
        }
        Update: {
          amount_fcfa?: number
          booking_id?: string
          cancelled_at?: string | null
          commission_fcfa?: number
          commission_rate?: number
          created_at?: string
          escrow_release_at?: string | null
          escrow_status?: string
          id?: string
          method?: string
          paid_at?: string | null
          payer_id?: string
          provider?: string
          status?: string
          teacher_id?: string
          teacher_payout_fcfa?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
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
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      teacher_profiles: {
        Row: {
          bio: string | null
          created_at: string
          headline: string | null
          id: string
          identity_verified: boolean
          offers_home: boolean
          offers_online: boolean
          qualifications_verified: boolean
          updated_at: string
          user_id: string
          verification_status: string
          years_experience: number | null
          zones: string[]
        }
        Insert: {
          bio?: string | null
          created_at?: string
          headline?: string | null
          id?: string
          identity_verified?: boolean
          offers_home?: boolean
          offers_online?: boolean
          qualifications_verified?: boolean
          updated_at?: string
          user_id: string
          verification_status?: string
          years_experience?: number | null
          zones?: string[]
        }
        Update: {
          bio?: string | null
          created_at?: string
          headline?: string | null
          id?: string
          identity_verified?: boolean
          offers_home?: boolean
          offers_online?: boolean
          qualifications_verified?: boolean
          updated_at?: string
          user_id?: string
          verification_status?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cancel_booking_payment: {
        Args: { p_booking_id: string; p_reason?: string }
        Returns: {
          amount_fcfa: number
          booking_id: string
          cancelled_at: string | null
          commission_fcfa: number
          commission_rate: number
          created_at: string
          escrow_release_at: string | null
          escrow_status: string
          id: string
          method: string
          paid_at: string | null
          payer_id: string
          provider: string
          status: string
          teacher_id: string
          teacher_payout_fcfa: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_booking_payment: {
        Args: { p_booking_id: string }
        Returns: {
          amount_fcfa: number
          booking_id: string
          cancelled_at: string | null
          commission_fcfa: number
          commission_rate: number
          created_at: string
          escrow_release_at: string | null
          escrow_status: string
          id: string
          method: string
          paid_at: string | null
          payer_id: string
          provider: string
          status: string
          teacher_id: string
          teacher_payout_fcfa: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
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
      mark_payment_paid: {
        Args: { p_booking_id: string; p_method?: string }
        Returns: {
          amount_fcfa: number
          booking_id: string
          cancelled_at: string | null
          commission_fcfa: number
          commission_rate: number
          created_at: string
          escrow_release_at: string | null
          escrow_status: string
          id: string
          method: string
          paid_at: string | null
          payer_id: string
          provider: string
          status: string
          teacher_id: string
          teacher_payout_fcfa: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "payments"
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
          p_offset?: number
          p_query?: string
          p_subject_slug?: string
        }
        Returns: {
          avatar_url: string
          city: string
          commune: string
          display_name: string
          headline: string
          identity_verified: boolean
          min_price_fcfa: number
          offers_home: boolean
          offers_online: boolean
          qualifications_verified: boolean
          subjects: string[]
          teacher_id: string
          years_experience: number
        }[]
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
