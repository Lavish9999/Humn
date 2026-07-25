import { cookies } from 'next/headers'; import { createServerSupabaseClient } from '@human/database/server';
export async function adminSupabase(){const c=await cookies();return createServerSupabaseClient({getAll:()=>c.getAll(),setAll:(items)=>{try{items.forEach(i=>c.set(i.name,i.value,i.options as never))}catch{}}});}
