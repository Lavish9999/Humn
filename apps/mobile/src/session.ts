import type { Session } from '@supabase/supabase-js'; import { create } from 'zustand';
type State={session:Session|null;ready:boolean;setSession:(s:Session|null)=>void;setReady:(r:boolean)=>void};
export const useSession=create<State>(set=>({session:null,ready:false,setSession:(session)=>set({session}),setReady:(ready)=>set({ready})}));
