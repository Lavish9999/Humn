begin;
select plan(14);

select has_table('public','users','users exists');
select has_table('public','works','works exists');
select has_table('public','proof_entries','proof entries exists');
select has_table('public','file_evidence','file evidence exists');
select has_table('public','technical_signals','technical signals exists');
select has_table('public','collections','collections exists');
select has_table('public','collection_items','collection items exists');
select has_table('public','follows','follows exists');
select has_table('public','reports','reports exists');
select is((select count(*)::int from public.works),31,'thirty-one coherent Works remain after the image-integrity audit');
select is((select count(*)::int from public.works where status='verified'),19,'verified distribution remains near sixty percent');
select is((select count(*)::int from public.works where status='awaiting'),8,'awaiting distribution remains near twenty-five percent');
select is((select count(*)::int from public.works where status='declared'),4,'declared distribution remains near fifteen percent');
select is((select count(*)::int from public.works where status='verified' and proof_count=0),0,'verified Works always have proof');

select * from finish();
rollback;
