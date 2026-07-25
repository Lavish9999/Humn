begin;

-- SEED IMAGE INTEGRITY INVARIANT:
-- A VERIFIED or AWAITING work must never use a photo of a screen, a stock UI
-- screenshot, or an image whose subject differs from its stated category,
-- title, and description. Screen captures are valid only when the work itself
-- is screen-based and the description explicitly says so.
-- Never rewrite work text to excuse an unrelated image: swap the image or
-- delete the record.

update public.works
set image_url = 'https://images.pexels.com/photos/10260568/pexels-photo-10260568.jpeg?auto=compress&cs=tinysrgb&w=1200',
    thumb_url = 'https://images.pexels.com/photos/10260568/pexels-photo-10260568.jpeg?auto=compress&cs=tinysrgb&w=600'
where id = '67331345-662a-5209-9f40-d93427e135f6'::uuid;

update public.works
set image_url = 'https://images.pexels.com/photos/17022634/pexels-photo-17022634.jpeg?auto=compress&cs=tinysrgb&w=1200',
    thumb_url = 'https://images.pexels.com/photos/17022634/pexels-photo-17022634.jpeg?auto=compress&cs=tinysrgb&w=600'
where id = 'fb992b4d-bfcb-5678-8839-f97fa62691ea'::uuid;

update public.works
set image_url = 'https://images.pexels.com/photos/5037263/pexels-photo-5037263.jpeg?auto=compress&cs=tinysrgb&w=1200',
    thumb_url = 'https://images.pexels.com/photos/5037263/pexels-photo-5037263.jpeg?auto=compress&cs=tinysrgb&w=600'
where id = '51641def-0459-5bbd-90f8-81165ba2f28f'::uuid;

update public.works
set image_url = 'https://images.pexels.com/photos/18031039/pexels-photo-18031039.jpeg?auto=compress&cs=tinysrgb&w=1200',
    thumb_url = 'https://images.pexels.com/photos/18031039/pexels-photo-18031039.jpeg?auto=compress&cs=tinysrgb&w=600'
where id = '610abae2-349b-5981-b6b7-01d1c20b2f90'::uuid;

update public.works
set image_url = 'https://images.pexels.com/photos/1460860/pexels-photo-1460860.jpeg?auto=compress&cs=tinysrgb&w=1200',
    thumb_url = 'https://images.pexels.com/photos/1460860/pexels-photo-1460860.jpeg?auto=compress&cs=tinysrgb&w=600'
where id = 'fc9aa88b-0712-53fb-afe1-1bff1f8bb8fb'::uuid;

update public.works
set image_url = 'https://images.pexels.com/photos/30907888/pexels-photo-30907888.jpeg?auto=compress&cs=tinysrgb&w=1200',
    thumb_url = 'https://images.pexels.com/photos/30907888/pexels-photo-30907888.jpeg?auto=compress&cs=tinysrgb&w=600'
where id = 'a3f616c4-2881-53a5-ba52-350642fe51fb'::uuid;

update public.works
set image_url = 'https://images.pexels.com/photos/36963443/pexels-photo-36963443.jpeg?auto=compress&cs=tinysrgb&w=1200',
    thumb_url = 'https://images.pexels.com/photos/36963443/pexels-photo-36963443.jpeg?auto=compress&cs=tinysrgb&w=600'
where id = 'a263db3b-b5a3-5e29-b3e1-93462c155e19'::uuid;

-- Records without a coherent replacement are removed. Dependent proof entries,
-- file evidence, technical signals, collection items, and reports are removed
-- by their existing ON DELETE CASCADE constraints.
delete from public.works
where id in (
  '6cfc27b6-3401-57ea-92ac-809465e77ae3'::uuid,
  '1852f38e-788b-50c7-a06d-92feeae1c318'::uuid,
  'b535c28d-7b30-5607-919a-faec30e3a3eb'::uuid,
  'cac25e16-8abc-5081-b885-9abeb745409a'::uuid,
  '1430bd08-eaea-555b-9321-2379f057967e'::uuid,
  '78432e37-bfde-5c97-93ac-fe3798e81cb2'::uuid,
  '5036e3d2-4264-5f30-a325-78f9c9120724'::uuid,
  'f21e0df0-1d96-5a9b-8988-eda880f605b8'::uuid,
  'd6abecec-4639-5e3a-89d3-a7e040301b80'::uuid
);

do $$
declare
  seed_ids uuid[] := array[
    '5333c9fd-1b14-56d8-a94e-d34797dd9fd6'::uuid,
    '59d201b6-8335-51bf-ad24-5eeaeecb4005'::uuid,
    'a643266d-7e5d-55df-a5bf-874e8fe78c6e'::uuid,
    'caba45cb-912a-5431-a581-a92b54268029'::uuid,
    'a12e13cb-62af-5613-aa36-9c8fccde00e1'::uuid,
    '4499c76c-0fb8-5457-b908-975d931a33f5'::uuid,
    '6cfc27b6-3401-57ea-92ac-809465e77ae3'::uuid,
    '67331345-662a-5209-9f40-d93427e135f6'::uuid,
    'ea83bb43-9e32-5440-a50f-fbbfd44a5f89'::uuid,
    '1852f38e-788b-50c7-a06d-92feeae1c318'::uuid,
    '2ea16b8c-1295-55bf-8c6f-6865787b019d'::uuid,
    'fb992b4d-bfcb-5678-8839-f97fa62691ea'::uuid,
    '852eb2eb-edc3-5cfa-a72e-6b00a1f305dc'::uuid,
    'f021c6d3-d0ef-582f-917d-3b29cd04e91e'::uuid,
    '51641def-0459-5bbd-90f8-81165ba2f28f'::uuid,
    '610abae2-349b-5981-b6b7-01d1c20b2f90'::uuid,
    '488c8449-00d4-5351-b377-f66dd7a086bd'::uuid,
    'dcf25a60-e604-5319-ba13-97d686bd9d98'::uuid,
    'dec1994b-3a9a-5d18-9ff2-3fdfbd9cbb28'::uuid,
    'b535c28d-7b30-5607-919a-faec30e3a3eb'::uuid,
    'f2adb87c-efbf-58e2-9065-42c1e852fe0b'::uuid,
    'ca7d4b32-a76b-52de-a18e-d378016f7557'::uuid,
    'cac25e16-8abc-5081-b885-9abeb745409a'::uuid,
    '297506df-46d9-562d-aba0-70ec45c62e12'::uuid,
    '51be54eb-a98a-5653-9827-eb5331bf4c3e'::uuid,
    '97e2cc3d-8e61-58fe-a33b-cd7f0d055e9d'::uuid,
    'd73c557c-82b6-521b-8f31-1ad773f3b610'::uuid,
    '316d39df-6576-5a3b-bef7-43fec36cb3a6'::uuid,
    '1430bd08-eaea-555b-9321-2379f057967e'::uuid,
    'c5d68964-f64e-5e1a-896c-3c628889e8e4'::uuid,
    'fc9aa88b-0712-53fb-afe1-1bff1f8bb8fb'::uuid,
    '78432e37-bfde-5c97-93ac-fe3798e81cb2'::uuid,
    '5036e3d2-4264-5f30-a325-78f9c9120724'::uuid,
    'a3f616c4-2881-53a5-ba52-350642fe51fb'::uuid,
    '8f83b34e-51b9-511f-a04e-9268dc0b939c'::uuid,
    'f21e0df0-1d96-5a9b-8988-eda880f605b8'::uuid,
    'a263db3b-b5a3-5e29-b3e1-93462c155e19'::uuid,
    'd6abecec-4639-5e3a-89d3-a7e040301b80'::uuid,
    'fe546201-8d6e-5080-8c7e-643496d8b7f4'::uuid,
    'b19e4987-089b-5453-bd00-6c58f26f1b93'::uuid
  ];
  surviving_ids uuid[] := array[
    '5333c9fd-1b14-56d8-a94e-d34797dd9fd6'::uuid,
    '59d201b6-8335-51bf-ad24-5eeaeecb4005'::uuid,
    'a643266d-7e5d-55df-a5bf-874e8fe78c6e'::uuid,
    'caba45cb-912a-5431-a581-a92b54268029'::uuid,
    'a12e13cb-62af-5613-aa36-9c8fccde00e1'::uuid,
    '4499c76c-0fb8-5457-b908-975d931a33f5'::uuid,
    '67331345-662a-5209-9f40-d93427e135f6'::uuid,
    'ea83bb43-9e32-5440-a50f-fbbfd44a5f89'::uuid,
    '2ea16b8c-1295-55bf-8c6f-6865787b019d'::uuid,
    'fb992b4d-bfcb-5678-8839-f97fa62691ea'::uuid,
    '852eb2eb-edc3-5cfa-a72e-6b00a1f305dc'::uuid,
    'f021c6d3-d0ef-582f-917d-3b29cd04e91e'::uuid,
    '51641def-0459-5bbd-90f8-81165ba2f28f'::uuid,
    '610abae2-349b-5981-b6b7-01d1c20b2f90'::uuid,
    '488c8449-00d4-5351-b377-f66dd7a086bd'::uuid,
    'dcf25a60-e604-5319-ba13-97d686bd9d98'::uuid,
    'dec1994b-3a9a-5d18-9ff2-3fdfbd9cbb28'::uuid,
    'f2adb87c-efbf-58e2-9065-42c1e852fe0b'::uuid,
    'ca7d4b32-a76b-52de-a18e-d378016f7557'::uuid,
    '297506df-46d9-562d-aba0-70ec45c62e12'::uuid,
    '51be54eb-a98a-5653-9827-eb5331bf4c3e'::uuid,
    '97e2cc3d-8e61-58fe-a33b-cd7f0d055e9d'::uuid,
    'd73c557c-82b6-521b-8f31-1ad773f3b610'::uuid,
    '316d39df-6576-5a3b-bef7-43fec36cb3a6'::uuid,
    'c5d68964-f64e-5e1a-896c-3c628889e8e4'::uuid,
    'fc9aa88b-0712-53fb-afe1-1bff1f8bb8fb'::uuid,
    'a3f616c4-2881-53a5-ba52-350642fe51fb'::uuid,
    '8f83b34e-51b9-511f-a04e-9268dc0b939c'::uuid,
    'a263db3b-b5a3-5e29-b3e1-93462c155e19'::uuid,
    'fe546201-8d6e-5080-8c7e-643496d8b7f4'::uuid,
    'b19e4987-089b-5453-bd00-6c58f26f1b93'::uuid
  ];
  swapped_ids uuid[] := array[
    '67331345-662a-5209-9f40-d93427e135f6'::uuid,
    'fb992b4d-bfcb-5678-8839-f97fa62691ea'::uuid,
    '51641def-0459-5bbd-90f8-81165ba2f28f'::uuid,
    '610abae2-349b-5981-b6b7-01d1c20b2f90'::uuid,
    'fc9aa88b-0712-53fb-afe1-1bff1f8bb8fb'::uuid,
    'a3f616c4-2881-53a5-ba52-350642fe51fb'::uuid,
    'a263db3b-b5a3-5e29-b3e1-93462c155e19'::uuid
  ];
  seed_total integer;
  verified_total integer;
  awaiting_total integer;
  declared_total integer;
  swap_total integer;
begin
  select count(*) into seed_total
  from public.works
  where id = any(seed_ids);

  select count(*) filter (where status = 'verified'),
         count(*) filter (where status = 'awaiting'),
         count(*) filter (where status = 'declared')
  into verified_total, awaiting_total, declared_total
  from public.works
  where id = any(surviving_ids);

  select count(*) into swap_total
  from public.works
  where id = any(swapped_ids)
    and image_url like 'https://images.pexels.com/%';

  if seed_total <> 31 then
    raise exception 'Seed image-integrity cleanup expected 31 surviving works, found %', seed_total;
  end if;

  if verified_total <> 19 or awaiting_total <> 8 or declared_total <> 4 then
    raise exception
      'Seed badge distribution expected verified=19 awaiting=8 declared=4, found verified=% awaiting=% declared=%',
      verified_total, awaiting_total, declared_total;
  end if;

  if swap_total <> 7 then
    raise exception 'Seed image-integrity cleanup expected 7 swapped image records, found %', swap_total;
  end if;

  if exists (
    select 1
    from public.works
    where id = any(surviving_ids)
      and status = 'verified'
      and proof_count < 1
  ) then
    raise exception 'Verified seed work with zero proof entries detected';
  end if;
end
$$;

commit;
