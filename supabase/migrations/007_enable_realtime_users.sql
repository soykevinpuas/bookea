-- Migration: 007_enable_realtime_users.sql
-- Bookea - Enable Realtime for the users table
-- Created: Abril 2026

-- 6.5.2 - Enable Realtime for the 'users' table
-- This allows clients, specially the useSubscription hook, to listen to subscription and role updates made from the admin panel instantly.
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
