-- Add AI provider preference to user profiles.
-- Supported values: 'gemini' (default) | 'openai'
ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_provider varchar DEFAULT 'gemini';