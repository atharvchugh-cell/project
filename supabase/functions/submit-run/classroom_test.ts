// Regression tests for the Classroom room rules enforced on the server.
import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { processRun } from "../_shared/runs.ts";
import { classroomBlock } from "../_shared/ai-guard.ts";

const ROOM = "11111111-1111-4111-8111-111111111111";

// Minimal stand-in for the database client: one room, records inserted runs.
function fakeDb(classroom: boolean) {
  const inserted: Record<string, unknown>[] = [];
  const client = {
    from(table: string) {
      return {
        select() { return this; },
        eq(_c: string, v: unknown) { (this as { v?: unknown }).v = v; return this; },
        maybeSingle() {
          const v = (this as { v?: unknown }).v;
          if (table === "game_sessions") return Promise.resolve({ data: v === ROOM ? { classroom } : null });
          return Promise.resolve({ data: null });
        },
        insert(row: Record<string, unknown>) {
          inserted.push(row);
          return { select: () => ({ single: () => Promise.resolve({ data: { id: "row" }, error: null }) }) };
        },
      };
    },
  };
  return { client, inserted };
}

const run = {
  completed: true, is_multiplayer: true, start_year: 2000, end_year: 2010, simulation_length: 10,
  starting_value: 10000, ending_value: 25000, room_session_id: ROOM, display_name: "Kid",
};

Deno.test("a classroom run is stored off the public leaderboard", async () => {
  const { client, inserted } = fakeDb(true);
  const res = await processRun(client, { ...run }, null, "RUN-TEST");
  assert(res.ok);
  assertEquals(inserted[0].classroom, true);
});

Deno.test("a normal room run stays eligible for the public leaderboard", async () => {
  const { client, inserted } = fakeDb(false);
  await processRun(client, { ...run }, null, "RUN-TEST");
  assertEquals(inserted[0].classroom, false);
});

Deno.test("an AI request from a classroom room is refused", async () => {
  const req = new Request("http://x", { headers: { "x-rr-room": ROOM } });
  const blocked = await classroomBlock(req, fakeDb(true).client);
  assertEquals(blocked?.status, 403);
  const open = await classroomBlock(req, fakeDb(false).client);
  assertEquals(open, null);
});

// Live check against the real chat function using a throwaway room.
const URL = Deno.env.get("SUPABASE_URL") ?? "https://tmoowkcxngosiyidozrd.supabase.co";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtb293a2N4bmdvc2l5aWRvenJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NTYxMDksImV4cCI6MjA5MDMzMjEwOX0.UhwKJpcQBza-0hEdYJLxk2JPvQ1KjMcnoMnJYwHnkBk";

Deno.test({ name: "a chat send is rejected while chat is off", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const db = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data: room, error } = await db.rpc("create_game_session", {
    p_game_code: "TST" + Math.floor(Math.random() * 900 + 100), p_host_name: "Test host",
    p_start_year: 2000, p_end_year: 2010, p_asset_configs: [],
  });
  assertEquals(error, null);
  const id = room.id, token = room.host_token;
  try {
    const { data: settings } = await db.rpc("set_room_settings", { p_session_id: id, p_token: token, p_classroom: true });
    assertEquals(settings.chat_enabled, false);
    const off = await db.rpc("send_room_message", { p_session_id: id, p_actor_id: null, p_token: token, p_body: "hi" });
    assert(off.error);
    assertStringIncludes(off.error.message, "Chat is turned off by the host");
    // A wrong token cannot change the setting.
    const forged = await db.rpc("set_room_settings", { p_session_id: id, p_token: crypto.randomUUID(), p_chat_enabled: true });
    assert(forged.error);
    await db.rpc("set_room_settings", { p_session_id: id, p_token: token, p_chat_enabled: true });
    const on = await db.rpc("send_room_message", { p_session_id: id, p_actor_id: null, p_token: token, p_body: "hi" });
    assertEquals(on.error, null);
  } finally {
    await db.rpc("secure_update_session", { p_session_id: id, p_token: token, p_status: "ended" });
  }
} });
