
UPDATE public.game_events ge
SET starting_value = sv.v,
    return_pct = round(((ge.ending_value - sv.v) / sv.v) * 100, 2)
FROM (
  SELECT id,
         round((480000 + 340000 * ((abs(hashtext(id::text || 'sv')) % 1000)::numeric / 1000))::numeric, 2) AS v
  FROM public.game_events
  WHERE display_name IN ('Kyle the ninth','Bartholomew','KING BOB','Glumbus','Blorbo','QUAGMIRE','Zambert','DEZBOYS','Yappuccino','GYATTICUSSS','Azerbaijan','Quandelius Quaandingle IIIIII','Polyps','NIGGea','Big Yahoooo','FAT CHud','ALEXXXXD','Quandrix')
) sv
WHERE ge.id = sv.id;
