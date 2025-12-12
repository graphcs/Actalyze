-- App Settings table for storing application configuration
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default auth settings
INSERT INTO app_settings (key, settings)
VALUES (
    'auth_settings',
    '{
        "mode": "restricted",
        "authorizedEmails": ["johnmahan7@gmail.com", "dan@datasyinc.com", "johnmaheswaran@datasyinc.com"],
        "adminEmails": ["johnmahan7@gmail.com", "dan@datasyinc.com"]
    }'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- Enable RLS (Row Level Security)
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for checking auth mode)
CREATE POLICY "Allow public read" ON app_settings
    FOR SELECT USING (true);

-- Allow public write access (for admin updates - you may want to restrict this later)
CREATE POLICY "Allow public write" ON app_settings
    FOR ALL USING (true);
