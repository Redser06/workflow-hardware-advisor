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
      catalog_items: {
        Row: {
          always_on_suitable: boolean
          baseline_price_checked_at: string
          baseline_price_usd: number
          battery_hours: number | null
          brand: string
          buy_url: string | null
          cpu_cores: number | null
          cpu_generation: string | null
          cpu_multicore_score: number | null
          cpu_name: string
          cpu_singlecore_score: number | null
          cpu_year: number | null
          created_at: string
          display_desc: string | null
          form_factor: string
          gpu_name: string | null
          gpu_score: number | null
          gpu_vram_gb: number | null
          id: string
          idle_watts: number | null
          load_watts: number | null
          name: string
          notes: string | null
          os: string | null
          price_confidence: string
          price_source_url: string | null
          ram_gb: number
          ram_max_gb: number | null
          ram_type: string | null
          ram_upgradeable: boolean
          segment: string
          slug: string
          storage_gb: number
          storage_type: string | null
          storage_upgradeable: boolean
          sustained_thermal_note: string | null
          unified_memory: boolean
          weight_kg: number | null
        }
        Insert: {
          always_on_suitable?: boolean
          baseline_price_checked_at: string
          baseline_price_usd: number
          battery_hours?: number | null
          brand: string
          buy_url?: string | null
          cpu_cores?: number | null
          cpu_generation?: string | null
          cpu_multicore_score?: number | null
          cpu_name: string
          cpu_singlecore_score?: number | null
          cpu_year?: number | null
          created_at?: string
          display_desc?: string | null
          form_factor: string
          gpu_name?: string | null
          gpu_score?: number | null
          gpu_vram_gb?: number | null
          id?: string
          idle_watts?: number | null
          load_watts?: number | null
          name: string
          notes?: string | null
          os?: string | null
          price_confidence?: string
          price_source_url?: string | null
          ram_gb: number
          ram_max_gb?: number | null
          ram_type?: string | null
          ram_upgradeable?: boolean
          segment: string
          slug: string
          storage_gb: number
          storage_type?: string | null
          storage_upgradeable?: boolean
          sustained_thermal_note?: string | null
          unified_memory?: boolean
          weight_kg?: number | null
        }
        Update: {
          always_on_suitable?: boolean
          baseline_price_checked_at?: string
          baseline_price_usd?: number
          battery_hours?: number | null
          brand?: string
          buy_url?: string | null
          cpu_cores?: number | null
          cpu_generation?: string | null
          cpu_multicore_score?: number | null
          cpu_name?: string
          cpu_singlecore_score?: number | null
          cpu_year?: number | null
          created_at?: string
          display_desc?: string | null
          form_factor?: string
          gpu_name?: string | null
          gpu_score?: number | null
          gpu_vram_gb?: number | null
          id?: string
          idle_watts?: number | null
          load_watts?: number | null
          name?: string
          notes?: string | null
          os?: string | null
          price_confidence?: string
          price_source_url?: string | null
          ram_gb?: number
          ram_max_gb?: number | null
          ram_type?: string | null
          ram_upgradeable?: boolean
          segment?: string
          slug?: string
          storage_gb?: number
          storage_type?: string | null
          storage_upgradeable?: boolean
          sustained_thermal_note?: string | null
          unified_memory?: boolean
          weight_kg?: number | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          client_message_id: string | null
          created_at: string
          id: string
          role: string
          session_id: string
          ui_message: Json
          user_id: string
        }
        Insert: {
          client_message_id?: string | null
          created_at?: string
          id?: string
          role: string
          session_id: string
          ui_message: Json
          user_id: string
        }
        Update: {
          client_message_id?: string | null
          created_at?: string
          id?: string
          role?: string
          session_id?: string
          ui_message?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      recommendations: {
        Row: {
          created_at: string
          id: string
          picks: Json
          session_id: string
          user_id: string
          workload_profile_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          picks: Json
          session_id: string
          user_id: string
          workload_profile_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          picks?: Json
          session_id?: string
          user_id?: string
          workload_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendations_workload_profile_id_fkey"
            columns: ["workload_profile_id"]
            isOneToOne: false
            referencedRelation: "workload_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      workload_profiles: {
        Row: {
          created_at: string
          id: string
          requirements: Json
          session_id: string
          summary: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          requirements: Json
          session_id: string
          summary: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          requirements?: Json
          session_id?: string
          summary?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workload_profiles_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
