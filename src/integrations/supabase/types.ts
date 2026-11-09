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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      ai_player_allowances: {
        Row: {
          created_at: string
          daily_requests: number | null
          monthly_allowance: number | null
          subject: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          daily_requests?: number | null
          monthly_allowance?: number | null
          subject: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          daily_requests?: number | null
          monthly_allowance?: number | null
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_response_cache: {
        Row: {
          created_at: string
          kind: string
          request_hash: string
          response: Json
          subject: string
        }
        Insert: {
          created_at?: string
          kind: string
          request_hash: string
          response: Json
          subject: string
        }
        Update: {
          created_at?: string
          kind?: string
          request_hash?: string
          response?: Json
          subject?: string
        }
        Relationships: []
      }
      ai_settings: {
        Row: {
          auto_lock_at_cap: boolean
          id: number
          locked: boolean
          monthly_cap_credits: number | null
          player_daily_requests: number | null
          player_monthly_allowance: number | null
          updated_at: string
        }
        Insert: {
          auto_lock_at_cap?: boolean
          id?: number
          locked?: boolean
          monthly_cap_credits?: number | null
          player_daily_requests?: number | null
          player_monthly_allowance?: number | null
          updated_at?: string
        }
        Update: {
          auto_lock_at_cap?: boolean
          id?: number
          locked?: boolean
          monthly_cap_credits?: number | null
          player_daily_requests?: number | null
          player_monthly_allowance?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      ai_usage_events: {
        Row: {
          created_at: string
          est_credits: number | null
          id: string
          input_tokens: number | null
          ip_hash: string | null
          is_guest: boolean
          kind: string
          model: string | null
          output_tokens: number | null
          session_id: string | null
          subject: string
        }
        Insert: {
          created_at?: string
          est_credits?: number | null
          id?: string
          input_tokens?: number | null
          ip_hash?: string | null
          is_guest?: boolean
          kind: string
          model?: string | null
          output_tokens?: number | null
          session_id?: string | null
          subject: string
        }
        Update: {
          created_at?: string
          est_credits?: number | null
          id?: string
          input_tokens?: number | null
          ip_hash?: string | null
          is_guest?: boolean
          kind?: string
          model?: string | null
          output_tokens?: number | null
          session_id?: string | null
          subject?: string
        }
        Relationships: []
      }
      challenges: {
        Row: {
          assets: Json
          code: string
          created_at: string
          creator_name: string
          end_year: number
          game_mode: string
          simulation_length: number | null
          source_run_id: string
          start_year: number
          target_return: number
          target_value: number
        }
        Insert: {
          assets?: Json
          code: string
          created_at?: string
          creator_name: string
          end_year: number
          game_mode: string
          simulation_length?: number | null
          source_run_id: string
          start_year: number
          target_return: number
          target_value: number
        }
        Update: {
          assets?: Json
          code?: string
          created_at?: string
          creator_name?: string
          end_year?: number
          game_mode?: string
          simulation_length?: number | null
          source_run_id?: string
          start_year?: number
          target_return?: number
          target_value?: number
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      feature_requests: {
        Row: {
          admin_reply: string | null
          contact: string | null
          created_at: string
          id: string
          message: string
          page: string | null
          public_summary: string | null
          publication_consent: boolean
          publication_consent_at: string | null
          published: boolean
          replied_at: string | null
          status: string
        }
        Insert: {
          admin_reply?: string | null
          contact?: string | null
          created_at?: string
          id?: string
          message: string
          page?: string | null
          public_summary?: string | null
          publication_consent?: boolean
          publication_consent_at?: string | null
          published?: boolean
          replied_at?: string | null
          status?: string
        }
        Update: {
          admin_reply?: string | null
          contact?: string | null
          created_at?: string
          id?: string
          message?: string
          page?: string | null
          public_summary?: string | null
          publication_consent?: boolean
          publication_consent_at?: string | null
          published?: boolean
          replied_at?: string | null
          status?: string
        }
        Relationships: []
      }
      game_events: {
        Row: {
          assets: Json | null
          challenge_code: string | null
          classroom: boolean
          client_run_id: string | null
          completed: boolean | null
          created_at: string
          device_type: string | null
          display_name: string | null
          end_year: number | null
          ending_value: number | null
          game_mode: string | null
          id: string
          is_multiplayer: boolean | null
          played_at: string
          player_count: number | null
          rank_position: number | null
          referrer: string | null
          return_pct: number | null
          room_session_id: string | null
          session_id: string | null
          simulation_length: number | null
          start_year: number | null
          starting_value: number | null
          time_spent_seconds: number | null
          trace_id: string | null
          trade_count: number | null
          user_id: string | null
        }
        Insert: {
          assets?: Json | null
          challenge_code?: string | null
          classroom?: boolean
          client_run_id?: string | null
          completed?: boolean | null
          created_at?: string
          device_type?: string | null
          display_name?: string | null
          end_year?: number | null
          ending_value?: number | null
          game_mode?: string | null
          id?: string
          is_multiplayer?: boolean | null
          played_at?: string
          player_count?: number | null
          rank_position?: number | null
          referrer?: string | null
          return_pct?: number | null
          room_session_id?: string | null
          session_id?: string | null
          simulation_length?: number | null
          start_year?: number | null
          starting_value?: number | null
          time_spent_seconds?: number | null
          trace_id?: string | null
          trade_count?: number | null
          user_id?: string | null
        }
        Update: {
          assets?: Json | null
          challenge_code?: string | null
          classroom?: boolean
          client_run_id?: string | null
          completed?: boolean | null
          created_at?: string
          device_type?: string | null
          display_name?: string | null
          end_year?: number | null
          ending_value?: number | null
          game_mode?: string | null
          id?: string
          is_multiplayer?: boolean | null
          played_at?: string
          player_count?: number | null
          rank_position?: number | null
          referrer?: string | null
          return_pct?: number | null
          room_session_id?: string | null
          session_id?: string | null
          simulation_length?: number | null
          start_year?: number | null
          starting_value?: number | null
          time_spent_seconds?: number | null
          trace_id?: string | null
          trade_count?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      game_players: {
        Row: {
          cash: number
          created_at: string
          holdings: Json
          id: string
          is_connected: boolean
          player_name: string
          portfolio_history: Json
          portfolio_value: number
          secret_token: string
          session_id: string
          total_contributions: number
          updated_at: string
        }
        Insert: {
          cash?: number
          created_at?: string
          holdings?: Json
          id?: string
          is_connected?: boolean
          player_name: string
          portfolio_history?: Json
          portfolio_value?: number
          secret_token?: string
          session_id: string
          total_contributions?: number
          updated_at?: string
        }
        Update: {
          cash?: number
          created_at?: string
          holdings?: Json
          id?: string
          is_connected?: boolean
          player_name?: string
          portfolio_history?: Json
          portfolio_value?: number
          secret_token?: string
          session_id?: string
          total_contributions?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_players_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      game_sessions: {
        Row: {
          asset_configs: Json
          chat_enabled: boolean
          classroom: boolean
          created_at: string
          end_year: number
          game_code: string
          game_started_at: string | null
          host_name: string
          host_token: string
          id: string
          paused_at: string | null
          paused_seconds: number
          start_year: number
          status: string
        }
        Insert: {
          asset_configs?: Json
          chat_enabled?: boolean
          classroom?: boolean
          created_at?: string
          end_year: number
          game_code: string
          game_started_at?: string | null
          host_name?: string
          host_token?: string
          id?: string
          paused_at?: string | null
          paused_seconds?: number
          start_year: number
          status?: string
        }
        Update: {
          asset_configs?: Json
          chat_enabled?: boolean
          classroom?: boolean
          created_at?: string
          end_year?: number
          game_code?: string
          game_started_at?: string | null
          host_name?: string
          host_token?: string
          id?: string
          paused_at?: string | null
          paused_seconds?: number
          start_year?: number
          status?: string
        }
        Relationships: []
      }
      pending_runs: {
        Row: {
          attempts: number
          client_run_id: string | null
          created_at: string
          final_value: number | null
          id: string
          last_error: string | null
          payload: Json
          processed_at: string | null
          reason: string | null
          return_pct: number | null
          simulation: Json | null
          status: string
          user_id: string | null
        }
        Insert: {
          attempts?: number
          client_run_id?: string | null
          created_at?: string
          final_value?: number | null
          id?: string
          last_error?: string | null
          payload: Json
          processed_at?: string | null
          reason?: string | null
          return_pct?: number | null
          simulation?: Json | null
          status?: string
          user_id?: string | null
        }
        Update: {
          attempts?: number
          client_run_id?: string | null
          created_at?: string
          final_value?: number | null
          id?: string
          last_error?: string | null
          payload?: Json
          processed_at?: string | null
          reason?: string | null
          return_pct?: number | null
          simulation?: Json | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar: string
          bio: string
          created_at: string
          display_name: string | null
          id: string
          social_presence: boolean
          social_requests: boolean
          social_visibility: string
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar?: string
          bio?: string
          created_at?: string
          display_name?: string | null
          id: string
          social_presence?: boolean
          social_requests?: boolean
          social_visibility?: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar?: string
          bio?: string
          created_at?: string
          display_name?: string | null
          id?: string
          social_presence?: boolean
          social_requests?: boolean
          social_visibility?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      room_messages: {
        Row: {
          body: string
          created_at: string
          id: number
          sender_id: string | null
          sender_kind: string
          sender_name: string
          session_id: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: never
          sender_id?: string | null
          sender_kind: string
          sender_name: string
          session_id: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: never
          sender_id?: string | null
          sender_kind?: string
          sender_name?: string
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      security_events: {
        Row: {
          created_at: string
          detail: Json | null
          event: string
          id: number
          ip_hash: string | null
          subject: string | null
        }
        Insert: {
          created_at?: string
          detail?: Json | null
          event: string
          id?: number
          ip_hash?: string | null
          subject?: string | null
        }
        Update: {
          created_at?: string
          detail?: Json | null
          event?: string
          id?: number
          ip_hash?: string | null
          subject?: string | null
        }
        Relationships: []
      }
      seo_monitor_state: {
        Row: {
          id: number
          known_issues_key: string
          last_checked_at: string
          last_issues: Json
        }
        Insert: {
          id?: number
          known_issues_key?: string
          last_checked_at?: string
          last_issues?: Json
        }
        Update: {
          id?: number
          known_issues_key?: string
          last_checked_at?: string
          last_issues?: Json
        }
        Relationships: []
      }
      social_blocks: {
        Row: {
          blocked: string
          created_at: string
          owner: string
        }
        Insert: {
          blocked: string
          created_at?: string
          owner: string
        }
        Update: {
          blocked?: string
          created_at?: string
          owner?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_blocks_blocked_fkey"
            columns: ["blocked"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_blocks_owner_fkey"
            columns: ["owner"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      social_friend_links: {
        Row: {
          created_at: string
          expires_at: string
          owner: string
          token: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          owner: string
          token?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          owner?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_friend_links_owner_fkey"
            columns: ["owner"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      social_match_actions: {
        Row: {
          action: Json
          created_at: string
          member_id: string
          request_id: string
          round: number
          second: number
        }
        Insert: {
          action: Json
          created_at?: string
          member_id: string
          request_id: string
          round: number
          second: number
        }
        Update: {
          action?: Json
          created_at?: string
          member_id?: string
          request_id?: string
          round?: number
          second?: number
        }
        Relationships: [
          {
            foreignKeyName: "social_match_actions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "social_match_members"
            referencedColumns: ["id"]
          },
        ]
      }
      social_match_invites: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          match_id: string
          recipient: string
          sender: string
          status: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          match_id: string
          recipient: string
          sender: string
          status?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          match_id?: string
          recipient?: string
          sender?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_match_invites_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "social_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_match_invites_recipient_fkey"
            columns: ["recipient"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_match_invites_sender_fkey"
            columns: ["sender"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      social_match_members: {
        Row: {
          created_at: string
          id: string
          match_id: string
          nickname: string
          player_id: string
          rematch_accepted: boolean
          token: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          match_id: string
          nickname: string
          player_id: string
          rematch_accepted?: boolean
          token?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          match_id?: string
          nickname?: string
          player_id?: string
          rematch_accepted?: boolean
          token?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_match_members_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "social_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_match_members_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "game_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_match_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      social_match_results: {
        Row: {
          contributions: number
          created_at: string
          data_version: number
          ending_value: number
          history: Json
          member_id: string
          return_pct: number
          round: number
          standouts: Json
        }
        Insert: {
          contributions: number
          created_at?: string
          data_version: number
          ending_value: number
          history: Json
          member_id: string
          return_pct: number
          round: number
          standouts?: Json
        }
        Update: {
          contributions?: number
          created_at?: string
          data_version?: number
          ending_value?: number
          history?: Json
          member_id?: string
          return_pct?: number
          round?: number
          standouts?: Json
        }
        Relationships: [
          {
            foreignKeyName: "social_match_results_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "social_match_members"
            referencedColumns: ["id"]
          },
        ]
      }
      social_matches: {
        Row: {
          best_of: number
          created_at: string
          current_round: number
          expires_at: string
          id: string
          invite_token: string
          owner: string
          request_id: string
          session_id: string
        }
        Insert: {
          best_of?: number
          created_at?: string
          current_round?: number
          expires_at?: string
          id?: string
          invite_token?: string
          owner: string
          request_id: string
          session_id: string
        }
        Update: {
          best_of?: number
          created_at?: string
          current_round?: number
          expires_at?: string
          id?: string
          invite_token?: string
          owner?: string
          request_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_matches_owner_fkey"
            columns: ["owner"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_matches_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      social_notifications: {
        Row: {
          actor: string | null
          created_at: string
          id: string
          kind: string
          read_at: string | null
          recipient: string
          reference_id: string | null
        }
        Insert: {
          actor?: string | null
          created_at?: string
          id?: string
          kind: string
          read_at?: string | null
          recipient: string
          reference_id?: string | null
        }
        Update: {
          actor?: string | null
          created_at?: string
          id?: string
          kind?: string
          read_at?: string | null
          recipient?: string
          reference_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_notifications_actor_fkey"
            columns: ["actor"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_notifications_recipient_fkey"
            columns: ["recipient"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      social_player_states: {
        Row: {
          member_id: string
          revision: number
          round: number
          state: Json
        }
        Insert: {
          member_id: string
          revision?: number
          round: number
          state: Json
        }
        Update: {
          member_id?: string
          revision?: number
          round?: number
          state?: Json
        }
        Relationships: [
          {
            foreignKeyName: "social_player_states_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "social_match_members"
            referencedColumns: ["id"]
          },
        ]
      }
      social_presence_sessions: {
        Row: {
          activity: string
          seen_at: string
          session_id: string
          user_id: string
        }
        Insert: {
          activity?: string
          seen_at?: string
          session_id: string
          user_id: string
        }
        Update: {
          activity?: string
          seen_at?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_presence_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      social_relationships: {
        Row: {
          created_at: string
          id: string
          recipient: string
          sender: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          recipient: string
          sender: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          recipient?: string
          sender?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_relationships_recipient_fkey"
            columns: ["recipient"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_relationships_sender_fkey"
            columns: ["sender"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      social_reports: {
        Row: {
          created_at: string
          id: string
          reason: string
          reported: string
          reporter: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          reported: string
          reporter: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          reported?: string
          reporter?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_reports_reported_fkey"
            columns: ["reported"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_reports_reporter_fkey"
            columns: ["reporter"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      social_rounds: {
        Row: {
          capital: number
          created_at: string
          finished: boolean
          manifest: Json
          match_id: string
          next_settings: Json | null
          paused_at: string | null
          paused_seconds: number
          rematch_status: string
          requested_by: string | null
          round: number
          started_at: string | null
        }
        Insert: {
          capital?: number
          created_at?: string
          finished?: boolean
          manifest: Json
          match_id: string
          next_settings?: Json | null
          paused_at?: string | null
          paused_seconds?: number
          rematch_status?: string
          requested_by?: string | null
          round: number
          started_at?: string | null
        }
        Update: {
          capital?: number
          created_at?: string
          finished?: boolean
          manifest?: Json
          match_id?: string
          next_settings?: Json | null
          paused_at?: string | null
          paused_seconds?: number
          rematch_status?: string
          requested_by?: string | null
          round?: number
          started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_rounds_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "social_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      tutorial_events: {
        Row: {
          created_at: string
          event: string
          id: number
          session_id: string
        }
        Insert: {
          created_at?: string
          event: string
          id?: never
          session_id: string
        }
        Update: {
          created_at?: string
          event?: string
          id?: never
          session_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_ai_player_usage: { Args: { p_days?: number }; Returns: Json }
      admin_ai_usage_summary: { Args: { p_days?: number }; Returns: Json }
      admin_credit_budget: { Args: never; Returns: Json }
      admin_list_accounts: { Args: { p_search?: string }; Returns: Json }
      admin_player_profile: { Args: { p_subject: string }; Returns: Json }
      admin_player_stats: { Args: { p_days?: number }; Returns: Json }
      ai_month_spend_estimate: {
        Args: { p_month_start: string }
        Returns: number
      }
      ai_player_allowance_status: { Args: { p_subject: string }; Returns: Json }
      claim_device_runs: { Args: { p_session_id: string }; Returns: number }
      consume_ai_quota: {
        Args: {
          p_ip_hash: string
          p_is_guest: boolean
          p_kind: string
          p_subject: string
        }
        Returns: Json
      }
      create_challenge: { Args: { p_trace_id: string }; Returns: string }
      create_game_player: {
        Args: { p_player_name: string; p_session_id: string }
        Returns: Json
      }
      create_game_session: {
        Args: {
          p_asset_configs: Json
          p_end_year: number
          p_game_code: string
          p_host_name: string
          p_start_year: number
        }
        Returns: Json
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      delete_my_run: { Args: { p_run_id: string }; Returns: boolean }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      export_my_data: { Args: never; Returns: Json }
      find_sessions_by_code: {
        Args: { p_game_code: string }
        Returns: {
          asset_configs: Json
          end_year: number
          game_code: string
          game_started_at: string
          host_name: string
          id: string
          start_year: number
          status: string
        }[]
      }
      get_challenge: { Args: { p_code: string }; Returns: Json }
      get_leaderboard: {
        Args: {
          p_end_year?: number
          p_kind?: string
          p_limit?: number
          p_sort?: string
          p_start_year?: number
        }
        Returns: {
          display_name: string
          end_year: number
          ending_value: number
          game_mode: string
          is_multiplayer: boolean
          played_at: string
          return_pct: number
          start_year: number
        }[]
      }
      get_my_runs: {
        Args: { p_limit?: number }
        Returns: {
          display_name: string
          end_year: number
          ending_value: number
          game_mode: string
          id: string
          is_multiplayer: boolean
          played_at: string
          rank_position: number
          return_pct: number
          start_year: number
          trace_id: string
          trade_count: number
        }[]
      }
      get_public_replies: {
        Args: { p_limit?: number }
        Returns: {
          admin_reply: string
          id: string
          message: string
          replied_at: string
          status: string
        }[]
      }
      get_public_run: { Args: { p_trace_id: string }; Returns: Json }
      get_room_clock: {
        Args: { p_session_id: string; p_token: string }
        Returns: Json
      }
      get_room_players: {
        Args: { p_session_id: string; p_token: string }
        Returns: {
          cash: number
          holdings: Json
          id: string
          is_connected: boolean
          player_name: string
          portfolio_history: Json
          portfolio_value: number
          session_id: string
          total_contributions: number
        }[]
      }
      get_room_settings: {
        Args: { p_actor_id: string; p_session_id: string; p_token: string }
        Returns: Json
      }
      get_room_status: {
        Args: { p_session_id: string; p_token: string }
        Returns: {
          game_started_at: string
          status: string
        }[]
      }
      get_run_percentile: {
        Args: { p_ending_value: number }
        Returns: {
          percentile: number
          rank_position: number
          total_runs: number
        }[]
      }
      get_session_players: {
        Args: { p_session_id: string }
        Returns: {
          cash: number
          holdings: Json
          id: string
          is_connected: boolean
          player_name: string
          portfolio_history: Json
          portfolio_value: number
          session_id: string
          total_contributions: number
        }[]
      }
      get_session_status: {
        Args: { p_session_id: string }
        Returns: {
          game_started_at: string
          status: string
        }[]
      }
      get_total_playthroughs: { Args: never; Returns: number }
      get_window_comparison: {
        Args: { p_end_year: number; p_start_year: number }
        Returns: {
          median_ending: number
          median_return: number
          runs: number
        }[]
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      read_room_messages: {
        Args: {
          p_actor_id: string
          p_after_id?: number
          p_session_id: string
          p_token: string
        }
        Returns: {
          body: string
          created_at: string
          id: number
          sender_id: string
          sender_kind: string
          sender_name: string
        }[]
      }
      record_ai_usage: {
        Args: {
          p_est_credits: number
          p_input_tokens: number
          p_model: string
          p_output_tokens: number
          p_reservation: string
        }
        Returns: undefined
      }
      refund_ai_quota: { Args: { p_reservation: string }; Returns: undefined }
      rejoin_game_player: {
        Args: { p_player_id: string; p_token: string }
        Returns: Json
      }
      room_elapsed_seconds: { Args: { p_session_id: string }; Returns: number }
      secure_update_player: {
        Args: {
          p_cash?: number
          p_holdings?: Json
          p_player_id: string
          p_portfolio_history?: Json
          p_portfolio_value?: number
          p_token: string
          p_total_contributions?: number
        }
        Returns: undefined
      }
      secure_update_session: {
        Args: {
          p_game_started_at?: string
          p_session_id: string
          p_status?: string
          p_token: string
        }
        Returns: undefined
      }
      send_room_message: {
        Args: {
          p_actor_id: string
          p_body: string
          p_session_id: string
          p_token: string
        }
        Returns: number
      }
      set_room_pause: {
        Args: { p_paused: boolean; p_session_id: string; p_token: string }
        Returns: undefined
      }
      set_room_settings: {
        Args: {
          p_chat_enabled?: boolean
          p_classroom?: boolean
          p_session_id: string
          p_token: string
        }
        Returns: Json
      }
      social_blocked: { Args: { a: string; b: string }; Returns: boolean }
      social_blocked_for_current_user: {
        Args: { p_target: string }
        Returns: boolean
      }
      social_commit_state: {
        Args: {
          p_action?: Json
          p_member: string
          p_request?: string
          p_result?: Json
          p_revision: number
          p_round: number
          p_state: Json
        }
        Returns: boolean
      }
      social_create_match: {
        Args: {
          p_best_of: number
          p_capital: number
          p_classroom: boolean
          p_manifest: Json
          p_nickname: string
          p_owner: string
          p_request: string
          p_state: Json
        }
        Returns: Json
      }
      social_friend_action: {
        Args: { p_action: string; p_target?: string; p_text?: string }
        Returns: Json
      }
      social_join_match: {
        Args: {
          p_match: string
          p_nickname: string
          p_state: Json
          p_user: string
        }
        Returns: Json
      }
      social_match_invite: {
        Args: { p_match: string; p_target: string }
        Returns: undefined
      }
      social_people: { Args: { p_search?: string }; Returns: Json }
      social_presence: {
        Args: { p_activity?: string; p_offline?: boolean; p_session: string }
        Returns: Json
      }
      social_profile: { Args: { p_target: string }; Returns: Json }
      social_round_transition: {
        Args: {
          p_manifest?: Json
          p_match: string
          p_member: string
          p_operation: string
          p_settings?: Json
          p_state?: Json
        }
        Returns: number
      }
      tag_ai_usage_session: {
        Args: { p_reservation: string; p_session_id: string }
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
