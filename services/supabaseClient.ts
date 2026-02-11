import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iwzwndbqxiiifvbfzich.supabase.co';
const supabaseKey = 'sb_publishable_LE-H9nsIPbCjzWGE1y-paw_in085g2z';

export const supabase = createClient(supabaseUrl, supabaseKey);