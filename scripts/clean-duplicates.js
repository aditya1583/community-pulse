
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load env
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envLocalPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanDuplicates() {
    console.log("Checking for duplicates...");
    const { data: pulses, error } = await supabase
        .from('pulses')
        .select('*')
        .eq('city', 'Leander, TX')
        .gt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: true });

    if (error) {
        console.error("Error fetching pulses:", error);
        return;
    }

    console.log(`Found ${pulses.length} recent pulses in Leander.`);

    const seenContent = new Set();
    const duplicates = [];

    for (const p of pulses) {
        // Normalize content for duplicate detection
        // Check for specific repeating phrases like "Farmers Grass"
        let key = p.message.toLowerCase();

        // Custom key for the Farmers Grass issue
        if (key.includes("farmers grass")) {
            key = "farmers-grass-unique-key";
        } else if (key.includes("old fm 2243")) {
            key = "traffic-old-fm-2243";
        }

        if (seenContent.has(key)) {
            duplicates.push(p.id);
        } else {
            seenContent.add(key);
        }
    }

    console.log(`Found ${duplicates.length} duplicates to remove.`);

    if (duplicates.length > 0) {
        const { error: delError } = await supabase
            .from('pulses')
            .delete()
            .in('id', duplicates);

        if (delError) {
            console.error("Error deleting:", delError);
        } else {
            console.log("Successfully removed duplicates.");
        }
    }
}

cleanDuplicates();
