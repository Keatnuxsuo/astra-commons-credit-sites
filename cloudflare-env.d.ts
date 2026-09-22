declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    EVENT_SEED_JSON?: string;
    EVENT_SEED_1?: string;
    EVENT_SEED_2?: string;
    EVENT_SEED_3?: string;
    EVENT_SEED_4?: string;
    EVENT_ROSTER_PATCH?: string;
    ORGANIZER_EMAIL?: string;
    BUCKET?: R2Bucket;
  }
}
