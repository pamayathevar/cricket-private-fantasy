-- Populate the IPL 2027 test league with the final IPL 2025 squads.
-- Source of truth: https://www.cricinfo.com/series/ipl-2025-1449924/squads
-- Cross-check: https://www.ipl.com/series/indian-premier-league-2025-129413/squad
-- Replacement players listed in the final squad are included.
-- All imported league players are open and have no auction price or owner.
begin;

create temporary table target_ipl2027_league on commit drop as
select id
from public.leagues
where slug = 'ipl-2027'
   or (
     season_year = 2027
     and (
       lower(name) = 'ipl 2027'
       or competition ilike '%indian premier league%'
       or competition ilike '%ipl%'
     )
   );

create temporary table target_ipl2027_squad_validation (
  target_count integer not null check (target_count = 1),
  existing_lineup_count integer not null check (existing_lineup_count = 0)
) on commit drop;

insert into target_ipl2027_squad_validation (target_count, existing_lineup_count)
select count(distinct target.id), count(submission.id)
from target_ipl2027_league target
left join public.lineup_submissions submission on submission.league_id = target.id;

create temporary table incoming_ipl2027_squad_groups (
  team_code text not null,
  role text not null check (role in ('BA', 'BO', 'WK', 'AL')),
  player_names text not null
) on commit drop;

insert into incoming_ipl2027_squad_groups (team_code, role, player_names)
values
  ('KKR','BA','Venkatesh Iyer, Ajinkya Rahane, Rinku Singh, Ramandeep Singh, Manish Pandey, Rovman Powell'),
  ('KKR','WK','Quinton de Kock, Angkrish Raghuvanshi, Luvnith Sisodia, Rahmanullah Gurbaz'),
  ('KKR','AL','Sunil Narine, Andre Russell, Anukul Roy, Moeen Ali'),
  ('KKR','BO','Spencer Johnson, Harshit Rana, Varun Chakaravarthy, Vaibhav Arora, Anrich Nortje, Umran Malik, Mayank Markande, Chetan Sakariya, Shivam Shukla'),

  ('RCB','BA','Virat Kohli, Rajat Patidar, Tim David, Devdutt Padikkal, Swastik Chhikara, Jacob Bethell, Mayank Agarwal'),
  ('RCB','WK','Phil Salt, Jitesh Sharma, Tim Seifert'),
  ('RCB','AL','Liam Livingstone, Krunal Pandya, Manoj Bhandage, Romario Shepherd, Swapnil Singh, Mohit Rathee'),
  ('RCB','BO','Rasikh Dar Salam, Suyash Sharma, Josh Hazlewood, Yash Dayal, Abhinandan Singh, Bhuvneshwar Kumar, Lungi Ngidi, Nuwan Thushara, Blessing Muzarabani'),

  ('SRH','BA','Travis Head, Abhishek Sharma, Aniket Verma, Abhinav Manohar, Sachin Baby, Atharva Taide, Smaran Ravichandran'),
  ('SRH','WK','Ishan Kishan, Heinrich Klaasen'),
  ('SRH','AL','Nitish Kumar Reddy, Wiaan Mulder, Kamindu Mendis, Harsh Dubey'),
  ('SRH','BO','Pat Cummins, Simarjeet Singh, Harshal Patel, Mohammed Shami, Adam Zampa, Jaydev Unadkat, Zeeshan Ansari, Rahul Chahar, Eshan Malinga'),

  ('RR','BA','Yashasvi Jaiswal, Nitish Rana, Shimron Hetmyer, Shubham Dubey, Vaibhav Suryavanshi'),
  ('RR','WK','Sanju Samson, Dhruv Jurel, Kunal Singh Rathore, Lhuan-dre Pretorius'),
  ('RR','AL','Riyan Parag, Wanindu Hasaranga, Yudhvir Singh Charak'),
  ('RR','BO','Jofra Archer, Maheesh Theekshana, Tushar Deshpande, Sandeep Sharma, Fazalhaq Farooqi, Akash Madhwal, Kumar Kartikeya, Kwena Maphaka, Ashok Sharma, Nandre Burger'),

  ('CSK','BA','Rahul Tripathi, Ruturaj Gaikwad, Deepak Hooda, Shaik Rasheed, Andre Siddarth, Dewald Brevis'),
  ('CSK','WK','MS Dhoni, Devon Conway, Vansh Bedi, Urvil Patel'),
  ('CSK','AL','Rachin Ravindra, Shivam Dube, Ravindra Jadeja, Sam Curran, Vijay Shankar, Jamie Overton, Ramakrishna Ghosh, Ayush Mhatre'),
  ('CSK','BO','Ravichandran Ashwin, Noor Ahmad, Nathan Ellis, Khaleel Ahmed, Kamlesh Nagarkoti, Matheesha Pathirana, Mukesh Choudhary, Shreyas Gopal, Anshul Kamboj, Gurjapneet Singh'),

  ('MI','BA','Rohit Sharma, Suryakumar Yadav, Tilak Varma, Naman Dhir, Bevon Jacobs, Charith Asalanka'),
  ('MI','WK','Ryan Rickelton, Robin Minz, Krishnan Shrijith, Jonny Bairstow'),
  ('MI','AL','Will Jacks, Mitchell Santner, Raj Angad Bawa, Corbin Bosch, Hardik Pandya, Arjun Tendulkar'),
  ('MI','BO','Deepak Chahar, Trent Boult, Satyanarayana Raju, Vignesh Puthur, Ashwani Kumar, Karn Sharma, Mujeeb Ur Rahman, Reece Topley, Jasprit Bumrah, Raghu Sharma, Richard Gleeson'),

  ('DC','BA','Faf du Plessis, Jake Fraser-McGurk, Sameer Rizvi, Ashutosh Sharma, Karun Nair, Sediqullah Atal'),
  ('DC','WK','Abishek Porel, Tristan Stubbs, Donovan Ferreira, KL Rahul'),
  ('DC','AL','Axar Patel, Vipraj Nigam, Darshan Nalkande, Ajay Mandal, Madhav Tiwari, Manvanth Kumar'),
  ('DC','BO','Mitchell Starc, Kuldeep Yadav, Mohit Sharma, Mukesh Kumar, Tripurana Vijay, T Natarajan, Dushmantha Chameera, Mustafizur Rahman'),

  ('LSG','BA','Ayush Badoni, David Miller, Abdul Samad, Himmat Singh, Matthew Breetzke'),
  ('LSG','WK','Rishabh Pant, Nicholas Pooran, Aryan Juyal'),
  ('LSG','AL','Mitchell Marsh, Aiden Markram, Shahbaz Ahmed, Rajvardhan Hangargekar, Arshin Kulkarni, Yuvraj Chaudhary'),
  ('LSG','BO','Digvesh Singh Rathi, Shardul Thakur, Ravi Bishnoi, Prince Yadav, M Siddharth, Akash Singh, Mayank Yadav, Mohsin Khan, Akash Deep, Avesh Khan, Shamar Joseph, William ORourke'),

  ('GT','BA','Shubman Gill, Sai Sudharsan, Shahrukh Khan, Rahul Tewatia, Sherfane Rutherford, Mahipal Lomror'),
  ('GT','WK','Jos Buttler, Anuj Rawat, Kumar Kushagra, Kusal Mendis'),
  ('GT','AL','Glenn Phillips, Washington Sundar, Nishant Sindhu, Karim Janat, Manav Suthar, Dasun Shanaka'),
  ('GT','BO','Sai Kishore, Arshad Khan, Rashid Khan, Kagiso Rabada, Mohammed Siraj, Prasidh Krishna, Ishant Sharma, Gerald Coetzee, Jayant Yadav, Gurnoor Singh Brar, Kulwant Khejroliya'),

  ('PBKS','BA','Priyansh Arya, Shreyas Iyer, Shashank Singh, Nehal Wadhera, Harnoor Pannu, Pyla Avinash'),
  ('PBKS','WK','Prabhsimran Singh, Vishnu Vinod, Josh Inglis'),
  ('PBKS','AL','Azmatullah Omarzai, Marcus Stoinis, Glenn Maxwell, Suryansh Shedge, Marco Jansen, Musheer Khan, Aaron Hardie, Mitchell Owen'),
  ('PBKS','BO','Arshdeep Singh, Yuzvendra Chahal, Vyshak Vijaykumar, Praveen Dubey, Harpreet Brar, Lockie Ferguson, Yash Thakur, Xavier Bartlett, Kuldeep Sen, Kyle Jamieson');

create temporary table incoming_ipl2027_players on commit drop as
select
  trim(player_name) as full_name,
  team_code,
  role
from incoming_ipl2027_squad_groups
cross join lateral regexp_split_to_table(player_names, ',') as player_name;

create unique index incoming_ipl2027_players_name_team_idx
  on incoming_ipl2027_players (lower(full_name), team_code);

create temporary table incoming_ipl2027_player_validation (
  player_count integer not null check (player_count = 251),
  team_count integer not null check (team_count = 10),
  missing_team_count integer not null check (missing_team_count = 0)
) on commit drop;

insert into incoming_ipl2027_player_validation (player_count, team_count, missing_team_count)
select
  count(*),
  count(distinct incoming.team_code),
  count(*) filter (where team.id is null)
from incoming_ipl2027_players incoming
left join public.cricket_teams team on team.code = incoming.team_code;

insert into public.players (full_name, team_id, role, active)
select incoming.full_name, team.id, incoming.role, true
from incoming_ipl2027_players incoming
join public.cricket_teams team on team.code = incoming.team_code
on conflict (full_name, team_id) do update
set role = excluded.role,
    active = true,
    updated_at = now();

insert into public.league_players (
  league_id, player_id, owner_member_id, acquisition_type,
  acquisition_price, active, acquired_at, released_at
)
select
  league.id,
  player.id,
  null,
  'open',
  0,
  true,
  null,
  null
from incoming_ipl2027_players incoming
cross join target_ipl2027_league league
join public.cricket_teams team on team.code = incoming.team_code
join public.players player
  on player.full_name = incoming.full_name
 and player.team_id = team.id
on conflict (league_id, player_id) do update
set owner_member_id = null,
    acquisition_type = 'open',
    acquisition_price = 0,
    active = true,
    acquired_at = null,
    released_at = null,
    updated_at = now();

commit;
