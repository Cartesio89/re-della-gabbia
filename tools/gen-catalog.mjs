// Prints the SQL that mirrors CATALOG (js/data.js) on the server. Apply it to the Supabase project after every change to the numbers.
import { CATALOG } from "../js/data.js";
console.log("create or replace function public.gabbia__catalog() returns jsonb language sql immutable set search_path to 'public' as $fn$ select $cat$" + JSON.stringify(CATALOG) + "$cat$::jsonb $fn$;");
