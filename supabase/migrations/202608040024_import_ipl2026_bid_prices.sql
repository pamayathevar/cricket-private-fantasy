-- Keep lineup selection cost (acquisition_price / M$) separate from final auction cost (bid_price / B$).
-- Source: Google Sheet "Copy of IPL2026", tab "Bid Summary", columns Player and B$ in each owner block.
begin;

alter table public.league_players
  add column if not exists bid_price numeric(10,2)
  check (bid_price is null or bid_price >= 0);

create temporary table incoming_ipl2026_bid_groups (
  owner_name text not null,
  player_bids text not null
) on commit drop;

insert into incoming_ipl2026_bid_groups (owner_name, player_bids)
values
('Bala','Arshad Khan|1,Rahul Tewatia|3.5,Nuwan Thushara|2,Romario Shepherd|4,Swapnil Singh|2,Sandeep Sharma|2.5,Shubham Dubey|1,Yudhvir Singh|1,Ishan Kishan|14,Travis Head|10,Anshul Kamboj|3,Ayush Mhatre|3.5,Shivam Dube|7.5,David Miller|6,Mukesh Kumar|4,Pathum Nissanka|4,Akash Deep|1,Vaibhav Arora|2.5,Akash Singh|1,Ayush Badoni|7,Ashwani Kumar|3,Mitchell Santner|4,Trent Boult|8,Lockie Ferguson|3.5,Vijaykumar Vyshak|1'),
('Jeba','Ashok Sharma|1,Sai Kishore|3.5,Jacob Bethell|3,Suyash Sharma|1.5,Jofra Archer|5.5,Heinrich Klaasen|12,Liam Livingstone|3,Shivam Mavi|1,Jamie Overton|2,Nathan Ellis|3.5,Ruturaj Gaikwad|14,Dushmantha Chameera|2.5,T Natarajan|2,Tristan Stubbs|4,Kartik Tyagi|1,Sunil Narine|11,Tejasvi Dahiya|1,Aiden Markram|14,Mohammed Shami|4.5,Naman Tiwari|1,Ryan Rickelton|5.5,Xavier Bartlett|3.5'),
('Johny','Jos Buttler|12,Krunal Pandya|8,Rajat Patidar|10,Yashasvi Jaiswal|12,Jaydev Unadkat|2.5,Pat Cummins|7,Akeal Hosein|4,Karun Nair|2,Rachin Ravindra|8,Avesh Khan|3,Corbin Bosch|2.5,Quinton de Kock|7.5,Will Jacks|3.5,Shreyas Iyer|12,Yuzvendra Chahal|6'),
('Mansur','Mohammed Siraj|6,Shubman Gill|15,Tim David|6,Ravi Bishnoi|4,Sam Curran|4.5,Shimron Hetmyer|7.5,Nitish Kumar Reddy|5,MS Dhoni|4,Rahul Chahar|3,Ben Duckett|1.5,Kyle Jamieson|2.5,Cameron Green|9.5,Rovman Powell|2,Anrich Nortje|3.5,Rishabh Pant|9,Jasprit Bumrah|11,Marcus Stoinis|6'),
('Murali','Glenn Phillips|2.5,Prasidh Krishna|6.5,Bhuvneshwar Kumar|6,Jitesh Sharma|6.5,Ravindra Jadeja|10,Harshal Patel|5.5,Sanju Samson|11,Kuldeep Yadav|7,Sameer Rizvi|1,Rinku Singh|7,Mayank Yadav|1.5,Nicholas Pooran|12,Suryakumar Yadav|16,Marco Jansen|6.5,Musheer Khan|1'),
('Pandiyan','Kumar Kushagra|1,M Shahrukh Khan|4,Washington Sundar|3,Josh Hazlewood|7,Vihaan Malhotra|1,Lhuan-dre Pretorius|3,Abhishek Sharma|13,Krains Fuletra|1,Kartik Sharma|5.5,Khaleel Ahmed|4,Prashant Veer|3,Lungi Ngidi|4.5,Nitish Rana|4,Vipraj Nigam|4.5,Angkrish Raghuvanshi|3.5,Varun Chakravarthy|6.5,Mitchell Marsh|13,Mohsin Khan|1,Mukul Choudhary|1,Shardul Thakur|2.5,Azmatullah Omarzai|3.5,Harpreet Brar|3,Nehal Wadhera|7.5'),
('Saravana','Jason Holder|6,Sai Sudharsan|13,Devdutt Padikkal|5.5,Mangesh Yadav|1,Tushar Deshpande|2,Vignesh Puthur|1.5,Aniket Verma|2.5,Zeeshan Ansari|2.5,Noor Ahmad|7,Mitchell Starc|6.5,Ajinkya Rahane|10,Harshit Rana|4,Digvesh Rathi|4,Deepak Chahar|5.5,Hardik Pandya|13,Arshdeep Singh|8,Prabhsimran Singh|8'),
('Sashi','Ishant Sharma|2,Kagiso Rabada|5.5,Rashid Khan|7.5,Rasikh Salam|1.5,Venkatesh Iyer|5.5,Yash Dayal|1,Dhruv Jurel|4,Eshan Malinga|3,Salil Arora|4,Dewald Brevis|6,Urvil Patel|2.5,Abishek Porel|3,Ashutosh Sharma|3,Axar Patel|12,Matheesha Pathirana|2,Ramandeep Singh|3,Abdul Samad|4.5,Prince Yadav|1,AM Ghazanfar|2.5,Naman Dhir|3,Tilak Varma|8.5,Priyansh Arya|9,Shashank Singh|5,Yash Thakur|1'),
('Tamil','Jayant Yadav|2,Jacob Duffy|2,Phil Salt|11,Virat Kohli|16,Adam Milne|2,Riyan Parag|11,Vaibhav Sooryavanshi|12,Jack Edwards|1,Kamindu Mendis|2,Matt Henry|2,Sarfaraz Khan|1,KL Rahul|13,Prithvi Shaw|1,Tim Seifert|3,Umran Malik|2,Arshin Kulkarni|1,Josh Inglis|3.5,Wanindu Hasaranga|2,Mayank Markande|1,Rohit Sharma|8.5,Sherfane Rutherford|2,Cooper Connolly|1');

create temporary table incoming_ipl2026_bids on commit drop as
select
  owner_name,
  trim(split_part(player_bid, '|', 1)) as player_name,
  split_part(player_bid, '|', 2)::numeric as bid_price
from incoming_ipl2026_bid_groups
cross join lateral regexp_split_to_table(player_bids, ',') as player_bid;

create temporary table incoming_ipl2026_bid_validation (
  source_rows integer not null check (source_rows = 180),
  matched_rows integer not null check (matched_rows = 180)
) on commit drop;

insert into incoming_ipl2026_bid_validation (source_rows, matched_rows)
select
  count(*),
  count(*) filter (where resolved.league_player_id is not null)
from incoming_ipl2026_bids incoming
left join public.league_members member
  on member.league_id = '10000000-0000-4000-8000-000000002026'
 and lower(member.display_name) = lower(incoming.owner_name)
left join lateral (
  select league_player.id as league_player_id
  from public.league_players league_player
  join public.players player on player.id = league_player.player_id
  where league_player.league_id = '10000000-0000-4000-8000-000000002026'
    and league_player.owner_member_id = member.id
    and lower(player.full_name) = lower(incoming.player_name)
) resolved on true;

update public.league_players league_player
set bid_price = incoming.bid_price,
    updated_at = now()
from incoming_ipl2026_bids incoming
join public.league_members member
  on member.league_id = '10000000-0000-4000-8000-000000002026'
 and lower(member.display_name) = lower(incoming.owner_name)
where league_player.league_id = '10000000-0000-4000-8000-000000002026'
  and league_player.owner_member_id = member.id
  and exists (
    select 1
    from public.players player
    where player.id = league_player.player_id
      and lower(player.full_name) = lower(incoming.player_name)
  );

commit;
