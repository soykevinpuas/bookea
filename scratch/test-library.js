const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testAdd() {
    const userId = '8d92822a-f800-478a-923f-e685f0ef779d'; // Example user from previous tasks
    const bookId = '9638fd4a-f2b1-4122-8356-829910d54a20'; // Example book

    console.log(`Testing add for user ${userId} and book ${bookId}`);

    // Simulate addToLibrary logic
    const { data: existing, error: err1 } = await supabase
      .from("user_books")
      .select("id")
      .eq("user_id", userId)
      .eq("book_id", bookId)
      .maybeSingle();

    if (err1) console.error('Error checking:', err1);
    console.log('Existing:', existing);

    const { data: insert, error: err2 } = await supabase
      .from("user_books")
      .upsert({
        user_id: userId,
        book_id: bookId,
        access_type: 'subscription'
      }, { onConflict: 'user_id,book_id' })
      .select()
      .maybeSingle();

    if (err2) console.error('Error upserting:', err2);
    console.log('Insert/Upsert result:', insert);
}

testAdd();
