-- DEVELOPMENT / VOLUME TEST DATA: MATCHES 11-20
-- Source: Google Sheet League tab and score-template tabs M11, M13-M20.
-- Cricket outcomes and scorecard IDs cross-checked with ESPNcricinfo / ESPN.
-- Match 12 (KKR vs PBKS) was washed out and is settled through
-- public.settle_no_result_match(), which refunds usage and rebases the first
-- later locked XI against Match 11. Matches 1-10 are preserved.
--
-- Rollout:
--   1. Run this whole file once in the Supabase SQL Editor.
--   2. Run verify_volume_test_matches_11_20.sql.
--   3. Confirm Match 21 is the next scheduled fixture (Aug 16, 19:30 IST).
-- Rollback:
--   - Before COMMIT, any error rolls the transaction back automatically.
--   - After COMMIT, the pre-run target state is stored in
--     public.volume_test_match_backup with label pre-volume-test-m11-m20-*.
--     Restore only the target rows from that JSON backup in a controlled admin
--     transaction. Matches 1-10 are never deleted by this script.
-- Safety:
--   - The script aborts if Match 12 was already settled, preventing an unsafe
--     second application of the immutable No Result audit.
begin;
set local statement_timeout = '180s';
set local lock_timeout = '15s';

do $$
declare
  v_admin_user uuid;
  v_match_12 uuid;
begin
  select member.user_id into v_admin_user
  from public.league_members member
  where member.league_id = '2fa606e1-2299-4c6d-9acf-348b7b858a49'
    and member.status = 'active'
    and member.role = 'league_admin'
    and member.user_id is not null
  order by member.created_at
  limit 1;

  if v_admin_user is null then
    raise exception 'No active league administrator with a user id was found';
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_admin_user, 'role', 'authenticated')::text,
    true
  );

  select fixture.id into v_match_12
  from public.fixtures fixture
  where fixture.league_id = '2fa606e1-2299-4c6d-9acf-348b7b858a49'
    and fixture.match_number = 12;

  if v_match_12 is null then
    raise exception 'Match 12 fixture was not found';
  end if;

  if exists (
    select 1
    from public.audit_events audit
    where audit.league_id = '2fa606e1-2299-4c6d-9acf-348b7b858a49'
      and audit.action = 'no_result_match_settled'
      and audit.entity_type = 'fixture'
      and audit.entity_id = v_match_12::text
  ) then
    raise exception 'Matches 11-20 were already loaded: Match 12 has an immutable No Result settlement';
  end if;
end $$;

create temporary table vt_lineups(
  owner_name text,
  match_number integer,
  captain_name text,
  vice_captain_name text,
  impact_name text,
  impact_type text,
  booster_code text,
  sheet_transfers integer
) on commit drop;

insert into vt_lineups values
('Bala',11,'Sanju Samson','Romario Shepherd','Shivam Dube','BAI','',8),
('Jeba',11,'Virat Kohli','Sanju Samson','Ruturaj Gaikwad','BAI','',5),
('Johny',11,'Rajat Patidar','Krunal Pandya','Virat Kohli','BAI','',4),
('Mansur',11,'Sanju Samson','Tim David','Virat Kohli','BAI','',3),
('Murali',11,'Sanju Samson','Jitesh Sharma','Virat Kohli','BAI','2UP',1),
('Pandiyan',11,'Virat Kohli','Prashant Veer','Khaleel Ahmed','BOI','',7),
('Saravana',11,'Virat Kohli','Ruturaj Gaikwad','Devdutt Padikkal','BAI','',6),
('Sashi',11,'Virat Kohli','Ayush Mhatre','Ruturaj Gaikwad','BAI','',9),
('Tamil',11,'Phil Salt','Sarfaraz Khan','Virat Kohli','BAI','',2),
('Bala',12,'Sanju Samson','Romario Shepherd','Shivam Dube','BAI','',0),
('Jeba',12,'Virat Kohli','Sanju Samson','Ruturaj Gaikwad','BAI','',0),
('Johny',12,'Rajat Patidar','Krunal Pandya','Virat Kohli','BAI','',0),
('Mansur',12,'Sanju Samson','Tim David','Virat Kohli','BAI','',0),
('Murali',12,'Sanju Samson','Jitesh Sharma','Virat Kohli','BAI','',0),
('Pandiyan',12,'Virat Kohli','Prashant Veer','Khaleel Ahmed','BOI','',0),
('Saravana',12,'Virat Kohli','Ruturaj Gaikwad','Devdutt Padikkal','BAI','',0),
('Sashi',12,'Virat Kohli','Ayush Mhatre','Ruturaj Gaikwad','BAI','',0),
('Tamil',12,'Phil Salt','Sarfaraz Khan','Virat Kohli','BAI','',0),
('Bala',13,'Mitchell Santner','Dhruv Jurel','Jasprit Bumrah','BOI','',7),
('Jeba',13,'Ryan Rickelton','Yashasvi Jaiswal','Vaibhav Sooryavanshi','BAI','',3),
('Johny',13,'Rajat Patidar','Krunal Pandya','Virat Kohli','BAI','',8),
('Mansur',13,'Sanju Samson','Tim David','Virat Kohli','BAI','',8),
('Murali',13,'Suryakumar Yadav','Ravindra Jadeja','Rohit Sharma','BAI','',6),
('Pandiyan',13,'Yashasvi Jaiswal','Shardul Thakur','Vaibhav Sooryavanshi','BAI','',2),
('Saravana',13,'Hardik Pandya','Rohit Sharma','Vaibhav Sooryavanshi','BAI','',5),
('Sashi',13,'Suryakumar Yadav','Dhruv Jurel','Yashasvi Jaiswal','BAI','',4),
('Tamil',13,'Rohit Sharma','Riyan Parag','Vaibhav Sooryavanshi','BAI','',1),
('Bala',14,'Pathum Nissanka','David Miller','Sai Sudharsan','BAI','',4),
('Jeba',14,'KL Rahul','Tristan Stubbs','T Natarajan','BOI','',5),
('Johny',14,'Jos Buttler','KL Rahul','Prasidh Krishna','BOI','',1),
('Mansur',14,'Shubman Gill','KL Rahul','Mohammed Siraj','BOI','',2),
('Murali',14,'Pathum Nissanka','Glenn Phillips','Sameer Rizvi','BAI','',6),
('Pandiyan',14,'Nitish Rana','Vipraj Nigam','Lungi Ngidi','BOI','',8),
('Saravana',14,'Sai Sudharsan','Jason Holder','','','',9),
('Sashi',14,'Axar Patel','Rashid Khan','Kagiso Rabada','BOI','',7),
('Tamil',14,'KL Rahul','Pathum Nissanka','Sai Sudharsan','BAI','',3),
('Bala',15,'Aiden Markram','Ayush Badoni','Finn Allen','BAI','',3),
('Jeba',15,'Aiden Markram','Mohammed Shami','Finn Allen','BAI','',2),
('Johny',15,'Nicholas Pooran','Mitchell Marsh','Avesh Khan','BOI','',6),
('Mansur',15,'Rishabh Pant','Cameron Green','Finn Allen','BAI','',4),
('Murali',15,'Finn Allen','Rinku Singh','Nicholas Pooran','BAI','',9),
('Pandiyan',15,'Angkrish Raghuvanshi','Aiden Markram','Mitchell Marsh','BAI','',1),
('Saravana',15,'Ajinkya Rahane','Varun Chakravarthy','Mohammed Shami','BOI','',7),
('Sashi',15,'Finn Allen','Abdul Samad','Prince Yadav','BOI','',8),
('Tamil',15,'Angkrish Raghuvanshi','Finn Allen','Mohammed Shami','BOI','',5),
('Bala',16,'Devdutt Padikkal','Virat Kohli','Yashasvi Jaiswal','BAI','',9),
('Jeba',16,'Yashasvi Jaiswal','Devdutt Padikkal','Virat Kohli','BAI','',8),
('Johny',16,'Yashasvi Jaiswal','Krunal Pandya','Rajat Patidar','BAI','',2),
('Mansur',16,'Tim David','Shimron Hetmyer','Vaibhav Sooryavanshi','BAI','',6),
('Murali',16,'Vaibhav Sooryavanshi','Bhuvneshwar Kumar','Devdutt Padikkal','BAI','',5),
('Pandiyan',16,'Virat Kohli','Yashasvi Jaiswal','Vaibhav Sooryavanshi','BAI','',3),
('Saravana',16,'Virat Kohli','Vaibhav Sooryavanshi','Devdutt Padikkal','BAI','',7),
('Sashi',16,'Virat Kohli','Vaibhav Sooryavanshi','Yashasvi Jaiswal','BAI','',4),
('Tamil',16,'Virat Kohli','Phil Salt','Vaibhav Sooryavanshi','BAI','',1),
('Bala',17,'Ishan Kishan','Travis Head','Vijaykumar Vyshak','BOI','',8),
('Jeba',17,'Ishan Kishan','Heinrich Klaasen','Priyansh Arya','BAI','',3),
('Johny',17,'Shreyas Iyer','Heinrich Klaasen','Yuzvendra Chahal','BOI','2UP',1),
('Mansur',17,'Nitish Kumar Reddy','Marcus Stoinis','Prabhsimran Singh','BAI','',6),
('Murali',17,'Ishan Kishan','Marco Jansen','Harshal Patel','BOI','',9),
('Pandiyan',17,'Abhishek Sharma','Nitish Kumar Reddy','Shreyas Iyer','BAI','',2),
('Saravana',17,'Prabhsimran Singh','Ishan Kishan','Arshdeep Singh','BOI','',5),
('Sashi',17,'Heinrich Klaasen','Priyansh Arya','Travis Head','BAI','',4),
('Tamil',17,'Ishan Kishan','David Payne','Cooper Connolly','BAI','',7),
('Bala',18,'Sanju Samson','Shivam Dube','Pathum Nissanka','BAI','2UP',1),
('Jeba',18,'KL Rahul','Tristan Stubbs','Ruturaj Gaikwad','BAI','',5),
('Johny',18,'KL Rahul','Karun Nair','Ruturaj Gaikwad','BAI','',9),
('Mansur',18,'KL Rahul','Sanju Samson','Dewald Brevis','BAI','',6),
('Murali',18,'Sanju Samson','Kuldeep Yadav','Sameer Rizvi','BAI','',2),
('Pandiyan',18,'KL Rahul','Dewald Brevis','Lungi Ngidi','BOI','',8),
('Saravana',18,'KL Rahul','Ruturaj Gaikwad','Sanju Samson','BAI','',3),
('Sashi',18,'Axar Patel','Ayush Mhatre','Dewald Brevis','BAI','',7),
('Tamil',18,'Sarfaraz Khan','Sameer Rizvi','KL Rahul','BAI','',4),
('Bala',19,'Jos Buttler','Nicholas Pooran','Sai Sudharsan','BAI','',6),
('Jeba',19,'Aiden Markram','Rishabh Pant','Mitchell Marsh','BAI','',3),
('Johny',19,'Jos Buttler','Mitchell Marsh','Prasidh Krishna','BOI','',1),
('Mansur',19,'Rishabh Pant','Shubman Gill','Mohammed Siraj','BOI','',2),
('Murali',19,'Nicholas Pooran','Glenn Phillips','Prasidh Krishna','BOI','',4),
('Pandiyan',19,'Aiden Markram','Washington Sundar','Mitchell Marsh','BAI','',7),
('Saravana',19,'Sai Sudharsan','Jos Buttler','Mohammed Shami','BOI','',5),
('Sashi',19,'Rashid Khan','Prince Yadav','Kagiso Rabada','BOI','',9),
('Tamil',19,'George Linde','Glenn Phillips','Sai Sudharsan','BAI','',8),
('Bala',20,'Mitchell Santner','Devdutt Padikkal','Tilak Varma','BAI','',9),
('Jeba',20,'Ryan Rickelton','Virat Kohli','Devdutt Padikkal','BAI','',6),
('Johny',20,'Rajat Patidar','Krunal Pandya','Virat Kohli','BAI','',2),
('Mansur',20,'Virat Kohli','Tim David','Rohit Sharma','BAI','',5),
('Murali',20,'Suryakumar Yadav','Virat Kohli','Devdutt Padikkal','BAI','',8),
('Pandiyan',20,'Virat Kohli','Rajat Patidar','Suryakumar Yadav','BAI','',4),
('Saravana',20,'Hardik Pandya','Devdutt Padikkal','Virat Kohli','BAI','',3),
('Sashi',20,'Virat Kohli','Tilak Varma','Suryakumar Yadav','BAI','',7),
('Tamil',20,'Virat Kohli','Phil Salt','Rohit Sharma','BAI','',1);

create temporary table vt_lineup_players(
  owner_name text,
  match_number integer,
  slot integer,
  player_name text,
  team_code text,
  role text,
  cost numeric,
  marker text
) on commit drop;

insert into vt_lineup_players values
('Bala',11,1,'Shivam Dube','CSK','AL',8.5,'BAI'),
('Bala',11,2,'Romario Shepherd','RCB','AL',8,'VC'),
('Bala',11,3,'Ayush Mhatre','CSK','BA',7,''),
('Bala',11,4,'Shivang Kumar','SRH','BO',7,''),
('Bala',11,5,'Devdutt Padikkal','RCB','BA',8,''),
('Bala',11,6,'Sai Sudharsan','GT','BA',8,''),
('Bala',11,7,'Anshul Kamboj','CSK','AL',7,''),
('Bala',11,8,'Sanju Samson','CSK','WK',8.5,'C'),
('Bala',11,9,'Axar Patel','DC','AL',8.5,''),
('Bala',11,10,'Finn Allen','KKR','BA',8,''),
('Bala',11,11,'Jasprit Bumrah','MI','BO',10,''),
('Jeba',11,1,'Sanju Samson','CSK','WK',8.5,'VC'),
('Jeba',11,2,'Ruturaj Gaikwad','CSK','BA',9,'BAI'),
('Jeba',11,3,'Finn Allen','KKR','BA',8,''),
('Jeba',11,4,'Ishan Kishan','SRH','WK',9,''),
('Jeba',11,5,'Priyansh Arya','PBKS','BA',7.5,''),
('Jeba',11,6,'Virat Kohli','RCB','BA',9,'C'),
('Jeba',11,7,'Abhishek Sharma','SRH','AL',8.5,''),
('Jeba',11,8,'Travis Head','SRH','BA',9,''),
('Jeba',11,9,'Jamie Overton','CSK','AL',8,''),
('Jeba',11,10,'Suyash Sharma','RCB','BO',7,''),
('Jeba',11,11,'Spencer Johnson','CSK','BO',7,''),
('Johny',11,1,'Nicholas Pooran','LSG','WK',9.5,''),
('Johny',11,2,'Rajat Patidar','RCB','BA',8,'C'),
('Johny',11,3,'Ruturaj Gaikwad','CSK','BA',9,''),
('Johny',11,4,'Krunal Pandya','RCB','AL',8.5,'VC'),
('Johny',11,5,'Travis Head','SRH','BA',9,''),
('Johny',11,6,'Vaibhav Sooryavanshi','RR','BA',8,''),
('Johny',11,7,'Heinrich Klaasen','SRH','WK',8.5,''),
('Johny',11,8,'Varun Chakravarthy','KKR','BO',8,''),
('Johny',11,9,'Virat Kohli','RCB','BA',9,'BAI'),
('Johny',11,10,'Ishan Kishan','SRH','WK',9,''),
('Johny',11,11,'Jaydev Unadkat','SRH','BO',8,''),
('Mansur',11,1,'Sanju Samson','CSK','WK',8.5,'C'),
('Mansur',11,2,'Khaleel Ahmed','CSK','BO',8,''),
('Mansur',11,3,'Ayush Mhatre','CSK','BA',7,''),
('Mansur',11,4,'Virat Kohli','RCB','BA',9,'BAI'),
('Mansur',11,5,'Tim David','RCB','BA',8.5,'VC'),
('Mansur',11,6,'Devdutt Padikkal','RCB','BA',8,''),
('Mansur',11,7,'Kumar Kushagra','GT','WK',7,''),
('Mansur',11,8,'Vaibhav Sooryavanshi','RR','BA',8,''),
('Mansur',11,9,'Abhishek Sharma','SRH','AL',8.5,''),
('Mansur',11,10,'Digvesh Rathi','LSG','BO',7.5,''),
('Mansur',11,11,'Finn Allen','KKR','BA',8,''),
('Murali',11,1,'Bhuvneshwar Kumar','RCB','BO',9,''),
('Murali',11,2,'Jacob Duffy','RCB','BO',8,''),
('Murali',11,3,'Ayush Mhatre','CSK','BA',7,''),
('Murali',11,4,'Romario Shepherd','RCB','AL',8,''),
('Murali',11,5,'Ruturaj Gaikwad','CSK','BA',9,''),
('Murali',11,6,'Virat Kohli','RCB','BA',9,'BAI'),
('Murali',11,7,'Sanju Samson','CSK','WK',8.5,'C'),
('Murali',11,8,'Devdutt Padikkal','RCB','BA',8,''),
('Murali',11,9,'Jitesh Sharma','RCB','WK',8.5,'VC'),
('Murali',11,10,'Matt Henry','CSK','BO',8,''),
('Murali',11,11,'Phil Salt','RCB','WK',8.5,''),
('Pandiyan',11,1,'Nicholas Pooran','LSG','WK',9.5,''),
('Pandiyan',11,2,'Digvesh Rathi','LSG','BO',7.5,''),
('Pandiyan',11,3,'Prashant Veer','CSK','AL',7,'VC'),
('Pandiyan',11,4,'Aiden Markram','LSG','BA',9,''),
('Pandiyan',11,5,'Khaleel Ahmed','CSK','BO',8,'BOI'),
('Pandiyan',11,6,'Kartik Sharma','CSK','WK',7,''),
('Pandiyan',11,7,'Virat Kohli','RCB','BA',9,'C'),
('Pandiyan',11,8,'Heinrich Klaasen','SRH','WK',8.5,''),
('Pandiyan',11,9,'Travis Head','SRH','BA',9,''),
('Pandiyan',11,10,'Nitish Kumar Reddy','SRH','AL',8.5,''),
('Pandiyan',11,11,'Ishan Kishan','SRH','WK',9,''),
('Saravana',11,1,'Noor Ahmad','CSK','BO',8,''),
('Saravana',11,2,'Vaibhav Sooryavanshi','RR','BA',8,''),
('Saravana',11,3,'Jason Holder','GT','AL',8.5,''),
('Saravana',11,4,'Devdutt Padikkal','RCB','BA',8,'BAI'),
('Saravana',11,5,'Virat Kohli','RCB','BA',9,'C'),
('Saravana',11,6,'Ishan Kishan','SRH','WK',9,''),
('Saravana',11,7,'Travis Head','SRH','BA',9,''),
('Saravana',11,8,'Ruturaj Gaikwad','CSK','BA',9,'VC'),
('Saravana',11,9,'Yashasvi Jaiswal','RR','BA',9,''),
('Saravana',11,10,'Sanju Samson','CSK','WK',8.5,''),
('Saravana',11,11,'Varun Chakravarthy','KKR','BO',8,''),
('Sashi',11,1,'Travis Head','SRH','BA',9,''),
('Sashi',11,2,'Venkatesh Iyer','RCB','AL',8.5,''),
('Sashi',11,3,'Urvil Patel','CSK','WK',7,''),
('Sashi',11,4,'Heinrich Klaasen','SRH','WK',8.5,''),
('Sashi',11,5,'Virat Kohli','RCB','BA',9,'C'),
('Sashi',11,6,'Prince Yadav','LSG','BO',7,''),
('Sashi',11,7,'Ayush Mhatre','CSK','BA',7,'VC'),
('Sashi',11,8,'Rasikh Salam','RCB','BO',7,''),
('Sashi',11,9,'Ruturaj Gaikwad','CSK','BA',9,'BAI'),
('Sashi',11,10,'Suryakumar Yadav','MI','BA',10,''),
('Sashi',11,11,'Yashasvi Jaiswal','RR','BA',9,''),
('Tamil',11,1,'Sarfaraz Khan','CSK','BA',7,'VC'),
('Tamil',11,2,'Ishan Kishan','SRH','WK',9,''),
('Tamil',11,3,'Yashasvi Jaiswal','RR','BA',9,''),
('Tamil',11,4,'Finn Allen','KKR','BA',8,''),
('Tamil',11,5,'Phil Salt','RCB','WK',8.5,'C'),
('Tamil',11,6,'Matt Henry','CSK','BO',8,''),
('Tamil',11,7,'Virat Kohli','RCB','BA',9,'BAI'),
('Tamil',11,8,'Jasprit Bumrah','MI','BO',10,''),
('Tamil',11,9,'Jacob Duffy','RCB','BO',8,''),
('Tamil',11,10,'Glenn Phillips','GT','AL',8,''),
('Tamil',11,11,'Angkrish Raghuvanshi','KKR','BA',7.5,''),
('Bala',12,1,'Shivam Dube','CSK','AL',8.5,'BAI'),
('Bala',12,2,'Romario Shepherd','RCB','AL',8,'VC'),
('Bala',12,3,'Ayush Mhatre','CSK','BA',7,''),
('Bala',12,4,'Shivang Kumar','SRH','BO',7,''),
('Bala',12,5,'Devdutt Padikkal','RCB','BA',8,''),
('Bala',12,6,'Sai Sudharsan','GT','BA',8,''),
('Bala',12,7,'Anshul Kamboj','CSK','AL',7,''),
('Bala',12,8,'Sanju Samson','CSK','WK',8.5,'C'),
('Bala',12,9,'Axar Patel','DC','AL',8.5,''),
('Bala',12,10,'Finn Allen','KKR','BA',8,''),
('Bala',12,11,'Jasprit Bumrah','MI','BO',10,''),
('Jeba',12,1,'Sanju Samson','CSK','WK',8.5,'VC'),
('Jeba',12,2,'Ruturaj Gaikwad','CSK','BA',9,'BAI'),
('Jeba',12,3,'Finn Allen','KKR','BA',8,''),
('Jeba',12,4,'Ishan Kishan','SRH','WK',9,''),
('Jeba',12,5,'Priyansh Arya','PBKS','BA',7.5,''),
('Jeba',12,6,'Virat Kohli','RCB','BA',9,'C'),
('Jeba',12,7,'Abhishek Sharma','SRH','AL',8.5,''),
('Jeba',12,8,'Travis Head','SRH','BA',9,''),
('Jeba',12,9,'Jamie Overton','CSK','AL',8,''),
('Jeba',12,10,'Suyash Sharma','RCB','BO',7,''),
('Jeba',12,11,'Spencer Johnson','CSK','BO',7,''),
('Johny',12,1,'Nicholas Pooran','LSG','WK',9.5,''),
('Johny',12,2,'Rajat Patidar','RCB','BA',8,'C'),
('Johny',12,3,'Ruturaj Gaikwad','CSK','BA',9,''),
('Johny',12,4,'Krunal Pandya','RCB','AL',8.5,'VC'),
('Johny',12,5,'Travis Head','SRH','BA',9,''),
('Johny',12,6,'Vaibhav Sooryavanshi','RR','BA',8,''),
('Johny',12,7,'Heinrich Klaasen','SRH','WK',8.5,''),
('Johny',12,8,'Varun Chakravarthy','KKR','BO',8,''),
('Johny',12,9,'Virat Kohli','RCB','BA',9,'BAI'),
('Johny',12,10,'Ishan Kishan','SRH','WK',9,''),
('Johny',12,11,'Jaydev Unadkat','SRH','BO',8,''),
('Mansur',12,1,'Sanju Samson','CSK','WK',8.5,'C'),
('Mansur',12,2,'Khaleel Ahmed','CSK','BO',8,''),
('Mansur',12,3,'Ayush Mhatre','CSK','BA',7,''),
('Mansur',12,4,'Virat Kohli','RCB','BA',9,'BAI'),
('Mansur',12,5,'Tim David','RCB','BA',8.5,'VC'),
('Mansur',12,6,'Devdutt Padikkal','RCB','BA',8,''),
('Mansur',12,7,'Kumar Kushagra','GT','WK',7,''),
('Mansur',12,8,'Vaibhav Sooryavanshi','RR','BA',8,''),
('Mansur',12,9,'Abhishek Sharma','SRH','AL',8.5,''),
('Mansur',12,10,'Digvesh Rathi','LSG','BO',7.5,''),
('Mansur',12,11,'Finn Allen','KKR','BA',8,''),
('Murali',12,1,'Bhuvneshwar Kumar','RCB','BO',9,''),
('Murali',12,2,'Jacob Duffy','RCB','BO',8,''),
('Murali',12,3,'Ayush Mhatre','CSK','BA',7,''),
('Murali',12,4,'Romario Shepherd','RCB','AL',8,''),
('Murali',12,5,'Ruturaj Gaikwad','CSK','BA',9,''),
('Murali',12,6,'Virat Kohli','RCB','BA',9,'BAI'),
('Murali',12,7,'Sanju Samson','CSK','WK',8.5,'C'),
('Murali',12,8,'Devdutt Padikkal','RCB','BA',8,''),
('Murali',12,9,'Jitesh Sharma','RCB','WK',8.5,'VC'),
('Murali',12,10,'Matt Henry','CSK','BO',8,''),
('Murali',12,11,'Phil Salt','RCB','WK',8.5,''),
('Pandiyan',12,1,'Nicholas Pooran','LSG','WK',9.5,''),
('Pandiyan',12,2,'Digvesh Rathi','LSG','BO',7.5,''),
('Pandiyan',12,3,'Prashant Veer','CSK','AL',7,'VC'),
('Pandiyan',12,4,'Aiden Markram','LSG','BA',9,''),
('Pandiyan',12,5,'Khaleel Ahmed','CSK','BO',8,'BOI'),
('Pandiyan',12,6,'Kartik Sharma','CSK','WK',7,''),
('Pandiyan',12,7,'Virat Kohli','RCB','BA',9,'C'),
('Pandiyan',12,8,'Heinrich Klaasen','SRH','WK',8.5,''),
('Pandiyan',12,9,'Travis Head','SRH','BA',9,''),
('Pandiyan',12,10,'Nitish Kumar Reddy','SRH','AL',8.5,''),
('Pandiyan',12,11,'Ishan Kishan','SRH','WK',9,''),
('Saravana',12,1,'Noor Ahmad','CSK','BO',8,''),
('Saravana',12,2,'Vaibhav Sooryavanshi','RR','BA',8,''),
('Saravana',12,3,'Jason Holder','GT','AL',8.5,''),
('Saravana',12,4,'Devdutt Padikkal','RCB','BA',8,'BAI'),
('Saravana',12,5,'Virat Kohli','RCB','BA',9,'C'),
('Saravana',12,6,'Ishan Kishan','SRH','WK',9,''),
('Saravana',12,7,'Travis Head','SRH','BA',9,''),
('Saravana',12,8,'Ruturaj Gaikwad','CSK','BA',9,'VC'),
('Saravana',12,9,'Yashasvi Jaiswal','RR','BA',9,''),
('Saravana',12,10,'Sanju Samson','CSK','WK',8.5,''),
('Saravana',12,11,'Varun Chakravarthy','KKR','BO',8,''),
('Sashi',12,1,'Travis Head','SRH','BA',9,''),
('Sashi',12,2,'Venkatesh Iyer','RCB','AL',8.5,''),
('Sashi',12,3,'Urvil Patel','CSK','WK',7,''),
('Sashi',12,4,'Heinrich Klaasen','SRH','WK',8.5,''),
('Sashi',12,5,'Virat Kohli','RCB','BA',9,'C'),
('Sashi',12,6,'Prince Yadav','LSG','BO',7,''),
('Sashi',12,7,'Ayush Mhatre','CSK','BA',7,'VC'),
('Sashi',12,8,'Rasikh Salam','RCB','BO',7,''),
('Sashi',12,9,'Ruturaj Gaikwad','CSK','BA',9,'BAI'),
('Sashi',12,10,'Suryakumar Yadav','MI','BA',10,''),
('Sashi',12,11,'Yashasvi Jaiswal','RR','BA',9,''),
('Tamil',12,1,'Sarfaraz Khan','CSK','BA',7,'VC'),
('Tamil',12,2,'Ishan Kishan','SRH','WK',9,''),
('Tamil',12,3,'Yashasvi Jaiswal','RR','BA',9,''),
('Tamil',12,4,'Finn Allen','KKR','BA',8,''),
('Tamil',12,5,'Phil Salt','RCB','WK',8.5,'C'),
('Tamil',12,6,'Matt Henry','CSK','BO',8,''),
('Tamil',12,7,'Virat Kohli','RCB','BA',9,'BAI'),
('Tamil',12,8,'Jasprit Bumrah','MI','BO',10,''),
('Tamil',12,9,'Jacob Duffy','RCB','BO',8,''),
('Tamil',12,10,'Glenn Phillips','GT','AL',8,''),
('Tamil',12,11,'Angkrish Raghuvanshi','KKR','BA',7.5,''),
('Bala',13,1,'Mitchell Santner','MI','AL',9,'C'),
('Bala',13,2,'Sandeep Sharma','RR','BO',8.5,''),
('Bala',13,3,'Dhruv Jurel','RR','WK',8,'VC'),
('Bala',13,4,'Shivang Kumar','SRH','BO',7,''),
('Bala',13,5,'Devdutt Padikkal','RCB','BA',8,''),
('Bala',13,6,'Sai Sudharsan','GT','BA',8,''),
('Bala',13,7,'Trent Boult','MI','BO',9,''),
('Bala',13,8,'Sanju Samson','CSK','WK',8.5,''),
('Bala',13,9,'Axar Patel','DC','AL',8.5,''),
('Bala',13,10,'Finn Allen','KKR','BA',8,''),
('Bala',13,11,'Jasprit Bumrah','MI','BO',10,'BOI'),
('Jeba',13,1,'Yashasvi Jaiswal','RR','BA',9,'VC'),
('Jeba',13,2,'Ryan Rickelton','MI','WK',8,'C'),
('Jeba',13,3,'Finn Allen','KKR','BA',8,''),
('Jeba',13,4,'Ishan Kishan','SRH','WK',9,''),
('Jeba',13,5,'Priyansh Arya','PBKS','BA',7.5,''),
('Jeba',13,6,'Virat Kohli','RCB','BA',9,''),
('Jeba',13,7,'Abhishek Sharma','SRH','AL',8.5,''),
('Jeba',13,8,'Travis Head','SRH','BA',9,''),
('Jeba',13,9,'Vaibhav Sooryavanshi','RR','BA',8,'BAI'),
('Jeba',13,10,'Jofra Archer','RR','BO',8.5,''),
('Jeba',13,11,'Spencer Johnson','CSK','BO',7,''),
('Johny',13,1,'Nicholas Pooran','LSG','WK',9.5,''),
('Johny',13,2,'Rajat Patidar','RCB','BA',8,'C'),
('Johny',13,3,'Ruturaj Gaikwad','CSK','BA',9,''),
('Johny',13,4,'Krunal Pandya','RCB','AL',8.5,'VC'),
('Johny',13,5,'Travis Head','SRH','BA',9,''),
('Johny',13,6,'Vaibhav Sooryavanshi','RR','BA',8,''),
('Johny',13,7,'Heinrich Klaasen','SRH','WK',8.5,''),
('Johny',13,8,'Varun Chakravarthy','KKR','BO',8,''),
('Johny',13,9,'Virat Kohli','RCB','BA',9,'BAI'),
('Johny',13,10,'Ishan Kishan','SRH','WK',9,''),
('Johny',13,11,'Jaydev Unadkat','SRH','BO',8,''),
('Mansur',13,1,'Sanju Samson','CSK','WK',8.5,'C'),
('Mansur',13,2,'Khaleel Ahmed','CSK','BO',8,''),
('Mansur',13,3,'Ayush Mhatre','CSK','BA',7,''),
('Mansur',13,4,'Virat Kohli','RCB','BA',9,'BAI'),
('Mansur',13,5,'Tim David','RCB','BA',8.5,'VC'),
('Mansur',13,6,'Devdutt Padikkal','RCB','BA',8,''),
('Mansur',13,7,'Kumar Kushagra','GT','WK',7,''),
('Mansur',13,8,'Vaibhav Sooryavanshi','RR','BA',8,''),
('Mansur',13,9,'Abhishek Sharma','SRH','AL',8.5,''),
('Mansur',13,10,'Digvesh Rathi','LSG','BO',7.5,''),
('Mansur',13,11,'Finn Allen','KKR','BA',8,''),
('Murali',13,1,'Rohit Sharma','MI','BA',9,'BAI'),
('Murali',13,2,'Jacob Duffy','RCB','BO',8,''),
('Murali',13,3,'Ayush Mhatre','CSK','BA',7,''),
('Murali',13,4,'Romario Shepherd','RCB','AL',8,''),
('Murali',13,5,'Ravindra Jadeja','RR','AL',9,'VC'),
('Murali',13,6,'Virat Kohli','RCB','BA',9,''),
('Murali',13,7,'Vaibhav Sooryavanshi','RR','BA',8,''),
('Murali',13,8,'Devdutt Padikkal','RCB','BA',8,''),
('Murali',13,9,'Suryakumar Yadav','MI','BA',10,'C'),
('Murali',13,10,'Matt Henry','CSK','BO',8,''),
('Murali',13,11,'Phil Salt','RCB','WK',8.5,''),
('Pandiyan',13,1,'Nicholas Pooran','LSG','WK',9.5,''),
('Pandiyan',13,2,'Digvesh Rathi','LSG','BO',7.5,''),
('Pandiyan',13,3,'Yashasvi Jaiswal','RR','BA',9,'C'),
('Pandiyan',13,4,'Aiden Markram','LSG','BA',9,''),
('Pandiyan',13,5,'Vaibhav Sooryavanshi','RR','BA',8,'BAI'),
('Pandiyan',13,6,'Shardul Thakur','MI','BO',8,'VC'),
('Pandiyan',13,7,'Virat Kohli','RCB','BA',9,''),
('Pandiyan',13,8,'Heinrich Klaasen','SRH','WK',8.5,''),
('Pandiyan',13,9,'Travis Head','SRH','BA',9,''),
('Pandiyan',13,10,'Nitish Kumar Reddy','SRH','AL',8.5,''),
('Pandiyan',13,11,'Ishan Kishan','SRH','WK',9,''),
('Saravana',13,1,'Tushar Deshpande','RR','BO',8,''),
('Saravana',13,2,'Vaibhav Sooryavanshi','RR','BA',8,'BAI'),
('Saravana',13,3,'Hardik Pandya','MI','AL',11,'C'),
('Saravana',13,4,'Deepak Chahar','MI','BO',8.5,''),
('Saravana',13,5,'Virat Kohli','RCB','BA',9,''),
('Saravana',13,6,'Ishan Kishan','SRH','WK',9,''),
('Saravana',13,7,'Rohit Sharma','MI','BA',9,'VC'),
('Saravana',13,8,'Ruturaj Gaikwad','CSK','BA',9,''),
('Saravana',13,9,'Yashasvi Jaiswal','RR','BA',9,''),
('Saravana',13,10,'Sanju Samson','CSK','WK',8.5,''),
('Saravana',13,11,'Varun Chakravarthy','KKR','BO',8,''),
('Sashi',13,1,'Travis Head','SRH','BA',9,''),
('Sashi',13,2,'Heinrich Klaasen','SRH','WK',8.5,''),
('Sashi',13,3,'Naman Dhir','MI','BA',7,''),
('Sashi',13,4,'Virat Kohli','RCB','BA',9,''),
('Sashi',13,5,'Suryakumar Yadav','MI','BA',10,'C'),
('Sashi',13,6,'Prince Yadav','LSG','BO',7,''),
('Sashi',13,7,'Dhruv Jurel','RR','WK',8,'VC'),
('Sashi',13,8,'AM Ghazanfar','MI','BO',7,''),
('Sashi',13,9,'Yashasvi Jaiswal','RR','BA',9,'BAI'),
('Sashi',13,10,'Ayush Mhatre','CSK','BA',7,''),
('Sashi',13,11,'Tilak Varma','MI','AL',8.5,''),
('Tamil',13,1,'Vaibhav Sooryavanshi','RR','BA',8,'BAI'),
('Tamil',13,2,'Ishan Kishan','SRH','WK',9,''),
('Tamil',13,3,'Yashasvi Jaiswal','RR','BA',9,''),
('Tamil',13,4,'Ryan Rickelton','MI','WK',8,''),
('Tamil',13,5,'Riyan Parag','RR','BA',8.5,'VC'),
('Tamil',13,6,'Mayank Markande','MI','BO',7.5,''),
('Tamil',13,7,'Rohit Sharma','MI','BA',9,'C'),
('Tamil',13,8,'Jasprit Bumrah','MI','BO',10,''),
('Tamil',13,9,'Sherfane Rutherford','MI','BA',8,''),
('Tamil',13,10,'Glenn Phillips','GT','AL',8,''),
('Tamil',13,11,'Angkrish Raghuvanshi','KKR','BA',7.5,''),
('Bala',14,1,'David Miller','DC','BA',9,'VC'),
('Bala',14,2,'Mukesh Kumar','DC','BO',8,''),
('Bala',14,3,'Jos Buttler','GT','WK',9.5,''),
('Bala',14,4,'Rahul Tewatia','GT','AL',8,''),
('Bala',14,5,'Devdutt Padikkal','RCB','BA',8,''),
('Bala',14,6,'Sai Sudharsan','GT','BA',8,'BAI'),
('Bala',14,7,'Pathum Nissanka','DC','BA',8,'C'),
('Bala',14,8,'Sanju Samson','CSK','WK',8.5,''),
('Bala',14,9,'Axar Patel','DC','AL',8.5,''),
('Bala',14,10,'Finn Allen','KKR','BA',8,''),
('Bala',14,11,'Jasprit Bumrah','MI','BO',10,''),
('Jeba',14,1,'Yashasvi Jaiswal','RR','BA',9,''),
('Jeba',14,2,'Tristan Stubbs','DC','BA',8,'VC'),
('Jeba',14,3,'Finn Allen','KKR','BA',8,''),
('Jeba',14,4,'KL Rahul','DC','WK',9,'C'),
('Jeba',14,5,'Priyansh Arya','PBKS','BA',7.5,''),
('Jeba',14,6,'Virat Kohli','RCB','BA',9,''),
('Jeba',14,7,'Abhishek Sharma','SRH','AL',8.5,''),
('Jeba',14,8,'Travis Head','SRH','BA',9,''),
('Jeba',14,9,'Vaibhav Sooryavanshi','RR','BA',8,''),
('Jeba',14,10,'T Natarajan','DC','BO',8,'BOI'),
('Jeba',14,11,'Ashok Sharma','GT','BO',7,''),
('Johny',14,1,'Nicholas Pooran','LSG','WK',9.5,''),
('Johny',14,2,'Jos Buttler','GT','WK',9.5,'C'),
('Johny',14,3,'KL Rahul','DC','WK',9,'VC'),
('Johny',14,4,'Krunal Pandya','RCB','AL',8.5,''),
('Johny',14,5,'Travis Head','SRH','BA',9,''),
('Johny',14,6,'Vaibhav Sooryavanshi','RR','BA',8,''),
('Johny',14,7,'Heinrich Klaasen','SRH','WK',8.5,''),
('Johny',14,8,'Varun Chakravarthy','KKR','BO',8,''),
('Johny',14,9,'Virat Kohli','RCB','BA',9,''),
('Johny',14,10,'Ishan Kishan','SRH','WK',9,''),
('Johny',14,11,'Prasidh Krishna','GT','BO',8,'BOI'),
('Mansur',14,1,'Axar Patel','DC','AL',8.5,''),
('Mansur',14,2,'Shubman Gill','GT','BA',9,'C'),
('Mansur',14,3,'Mohammed Siraj','GT','BO',8.5,'BOI'),
('Mansur',14,4,'KL Rahul','DC','WK',9,'VC'),
('Mansur',14,5,'Khaleel Ahmed','CSK','BO',8,''),
('Mansur',14,6,'Abhishek Sharma','SRH','AL',8.5,''),
('Mansur',14,7,'Vaibhav Sooryavanshi','RR','BA',8,''),
('Mansur',14,8,'Virat Kohli','RCB','BA',9,''),
('Mansur',14,9,'Devdutt Padikkal','RCB','BA',8,''),
('Mansur',14,10,'Digvesh Rathi','LSG','BO',7.5,''),
('Mansur',14,11,'Finn Allen','KKR','BA',8,''),
('Murali',14,1,'Pathum Nissanka','DC','BA',8,'C'),
('Murali',14,2,'Jacob Duffy','RCB','BO',8,''),
('Murali',14,3,'Ayush Mhatre','CSK','BA',7,''),
('Murali',14,4,'Glenn Phillips','GT','AL',8,'VC'),
('Murali',14,5,'Sameer Rizvi','DC','BA',7,'BAI'),
('Murali',14,6,'Virat Kohli','RCB','BA',9,''),
('Murali',14,7,'Vaibhav Sooryavanshi','RR','BA',8,''),
('Murali',14,8,'Devdutt Padikkal','RCB','BA',8,''),
('Murali',14,9,'Prasidh Krishna','GT','BO',8,''),
('Murali',14,10,'Sai Sudharsan','GT','BA',8,''),
('Murali',14,11,'Phil Salt','RCB','WK',8.5,''),
('Pandiyan',14,1,'Nicholas Pooran','LSG','WK',9.5,''),
('Pandiyan',14,2,'Nitish Rana','DC','BA',8,'C'),
('Pandiyan',14,3,'Yashasvi Jaiswal','RR','BA',9,''),
('Pandiyan',14,4,'Aiden Markram','LSG','BA',9,''),
('Pandiyan',14,5,'Vaibhav Sooryavanshi','RR','BA',8,''),
('Pandiyan',14,6,'Lungi Ngidi','DC','BO',8,'BOI'),
('Pandiyan',14,7,'Virat Kohli','RCB','BA',9,''),
('Pandiyan',14,8,'Vipraj Nigam','DC','BO',7.5,'VC'),
('Pandiyan',14,9,'Washington Sundar','GT','AL',8,''),
('Pandiyan',14,10,'Nitish Kumar Reddy','SRH','AL',8.5,''),
('Pandiyan',14,11,'M Shahrukh Khan','GT','BA',8,''),
('Saravana',14,1,'Sai Sudharsan','GT','BA',8,'C'),
('Saravana',14,2,'Vaibhav Sooryavanshi','RR','BA',8,''),
('Saravana',14,3,'Jason Holder','GT','AL',8.5,'VC'),
('Saravana',14,4,'Deepak Chahar','MI','BO',8.5,''),
('Saravana',14,5,'Virat Kohli','RCB','BA',9,''),
('Saravana',14,6,'Ishan Kishan','SRH','WK',9,''),
('Saravana',14,7,'Rohit Sharma','MI','BA',9,''),
('Saravana',14,8,'Ruturaj Gaikwad','CSK','BA',9,''),
('Saravana',14,9,'Yashasvi Jaiswal','RR','BA',9,''),
('Saravana',14,10,'Sanju Samson','CSK','WK',8.5,''),
('Saravana',14,11,'Varun Chakravarthy','KKR','BO',8,''),
('Sashi',14,1,'Travis Head','SRH','BA',9,''),
('Sashi',14,2,'Heinrich Klaasen','SRH','WK',8.5,''),
('Sashi',14,3,'Ishant Sharma','GT','BO',8,''),
('Sashi',14,4,'Virat Kohli','RCB','BA',9,''),
('Sashi',14,5,'Axar Patel','DC','AL',8.5,'C'),
('Sashi',14,6,'Suryakumar Yadav','MI','BA',10,''),
('Sashi',14,7,'Rashid Khan','GT','AL',9.5,'VC'),
('Sashi',14,8,'Ashutosh Sharma','DC','AL',7.5,''),
('Sashi',14,9,'Kagiso Rabada','GT','BO',8.5,'BOI'),
('Sashi',14,10,'Yashasvi Jaiswal','RR','BA',9,''),
('Sashi',14,11,'Ayush Mhatre','CSK','BA',7,''),
('Tamil',14,1,'KL Rahul','DC','WK',9,'C'),
('Tamil',14,2,'Ishan Kishan','SRH','WK',9,''),
('Tamil',14,3,'Yashasvi Jaiswal','RR','BA',9,''),
('Tamil',14,4,'Ryan Rickelton','MI','WK',8,''),
('Tamil',14,5,'Jayant Yadav','GT','BO',8,''),
('Tamil',14,6,'Sai Sudharsan','GT','BA',8,'BAI'),
('Tamil',14,7,'Pathum Nissanka','DC','BA',8,'VC'),
('Tamil',14,8,'Jasprit Bumrah','MI','BO',10,''),
('Tamil',14,9,'Sherfane Rutherford','MI','BA',8,''),
('Tamil',14,10,'Glenn Phillips','GT','AL',8,''),
('Tamil',14,11,'Angkrish Raghuvanshi','KKR','BA',7.5,''),
('Bala',15,1,'Ayush Badoni','LSG','BA',7.5,'VC'),
('Bala',15,2,'Vaibhav Arora','KKR','BO',7.5,''),
('Bala',15,3,'Jos Buttler','GT','WK',9.5,''),
('Bala',15,4,'Aiden Markram','LSG','BA',9,'C'),
('Bala',15,5,'Devdutt Padikkal','RCB','BA',8,''),
('Bala',15,6,'Sai Sudharsan','GT','BA',8,''),
('Bala',15,7,'Pathum Nissanka','DC','BA',8,''),
('Bala',15,8,'Sanju Samson','CSK','WK',8.5,''),
('Bala',15,9,'Axar Patel','DC','AL',8.5,''),
('Bala',15,10,'Finn Allen','KKR','BA',8,'BAI'),
('Bala',15,11,'Jasprit Bumrah','MI','BO',10,''),
('Jeba',15,1,'Yashasvi Jaiswal','RR','BA',9,''),
('Jeba',15,2,'Aiden Markram','LSG','BA',9,'C'),
('Jeba',15,3,'Finn Allen','KKR','BA',8,'BAI'),
('Jeba',15,4,'KL Rahul','DC','WK',9,''),
('Jeba',15,5,'Priyansh Arya','PBKS','BA',7.5,''),
('Jeba',15,6,'Virat Kohli','RCB','BA',9,''),
('Jeba',15,7,'Sunil Narine','KKR','AL',8.5,''),
('Jeba',15,8,'Travis Head','SRH','BA',9,''),
('Jeba',15,9,'Vaibhav Sooryavanshi','RR','BA',8,''),
('Jeba',15,10,'Mohammed Shami','LSG','BO',8,'VC'),
('Jeba',15,11,'Kartik Tyagi','KKR','BO',7,''),
('Johny',15,1,'Nicholas Pooran','LSG','WK',9.5,'C'),
('Johny',15,2,'Avesh Khan','LSG','BO',8.5,'BOI'),
('Johny',15,3,'KL Rahul','DC','WK',9,''),
('Johny',15,4,'Mitchell Marsh','LSG','AL',9,'VC'),
('Johny',15,5,'Travis Head','SRH','BA',9,''),
('Johny',15,6,'Vaibhav Sooryavanshi','RR','BA',8,''),
('Johny',15,7,'Heinrich Klaasen','SRH','WK',8.5,''),
('Johny',15,8,'Finn Allen','KKR','BA',8,''),
('Johny',15,9,'Virat Kohli','RCB','BA',9,''),
('Johny',15,10,'Ishan Kishan','SRH','WK',9,''),
('Johny',15,11,'Prasidh Krishna','GT','BO',8,''),
('Mansur',15,1,'Digvesh Rathi','LSG','BO',7.5,''),
('Mansur',15,2,'Finn Allen','KKR','BA',8,'BAI'),
('Mansur',15,3,'Cameron Green','KKR','AL',8.5,'VC'),
('Mansur',15,4,'Rishabh Pant','LSG','WK',9,'C'),
('Mansur',15,5,'Rovman Powell','KKR','BA',8.5,''),
('Mansur',15,6,'KL Rahul','DC','WK',9,''),
('Mansur',15,7,'Khaleel Ahmed','CSK','BO',8,''),
('Mansur',15,8,'Abhishek Sharma','SRH','AL',8.5,''),
('Mansur',15,9,'Vaibhav Sooryavanshi','RR','BA',8,''),
('Mansur',15,10,'Virat Kohli','RCB','BA',9,''),
('Mansur',15,11,'Devdutt Padikkal','RCB','BA',8,''),
('Murali',15,1,'Pathum Nissanka','DC','BA',8,''),
('Murali',15,2,'Jacob Duffy','RCB','BO',8,''),
('Murali',15,3,'Ayush Mhatre','CSK','BA',7,''),
('Murali',15,4,'Marco Jansen','PBKS','AL',8.5,''),
('Murali',15,5,'Rinku Singh','KKR','BA',8.5,'VC'),
('Murali',15,6,'Virat Kohli','RCB','BA',9,''),
('Murali',15,7,'Vaibhav Sooryavanshi','RR','BA',8,''),
('Murali',15,8,'Devdutt Padikkal','RCB','BA',8,''),
('Murali',15,9,'Mayank Yadav','LSG','BO',7,''),
('Murali',15,10,'Nicholas Pooran','LSG','WK',9.5,'BAI'),
('Murali',15,11,'Finn Allen','KKR','BA',8,'C'),
('Pandiyan',15,1,'Varun Chakravarthy','KKR','BO',8,''),
('Pandiyan',15,2,'Angkrish Raghuvanshi','KKR','BA',7.5,'C'),
('Pandiyan',15,3,'Nicholas Pooran','LSG','WK',9.5,''),
('Pandiyan',15,4,'Mitchell Marsh','LSG','AL',9,'BAI'),
('Pandiyan',15,5,'Aiden Markram','LSG','BA',9,'VC'),
('Pandiyan',15,6,'Mukul Choudhary','LSG','BA',7,''),
('Pandiyan',15,7,'Mohsin Khan','LSG','BO',7.5,''),
('Pandiyan',15,8,'Virat Kohli','RCB','BA',9,''),
('Pandiyan',15,9,'Yashasvi Jaiswal','RR','BA',9,''),
('Pandiyan',15,10,'Vaibhav Sooryavanshi','RR','BA',8,''),
('Pandiyan',15,11,'Nitish Kumar Reddy','SRH','AL',8.5,''),
('Saravana',15,1,'Ajinkya Rahane','KKR','BA',8.5,'C'),
('Saravana',15,2,'Vaibhav Sooryavanshi','RR','BA',8,''),
('Saravana',15,3,'Jason Holder','GT','AL',8.5,''),
('Saravana',15,4,'Mohammed Shami','LSG','BO',8,'BOI'),
('Saravana',15,5,'Virat Kohli','RCB','BA',9,''),
('Saravana',15,6,'Ishan Kishan','SRH','WK',9,''),
('Saravana',15,7,'Rohit Sharma','MI','BA',9,''),
('Saravana',15,8,'Ruturaj Gaikwad','CSK','BA',9,''),
('Saravana',15,9,'Yashasvi Jaiswal','RR','BA',9,''),
('Saravana',15,10,'Sanju Samson','CSK','WK',8.5,''),
('Saravana',15,11,'Varun Chakravarthy','KKR','BO',8,'VC'),
('Sashi',15,1,'Travis Head','SRH','BA',9,''),
('Sashi',15,2,'Heinrich Klaasen','SRH','WK',8.5,''),
('Sashi',15,3,'Matheesha Pathirana','KKR','BO',8,''),
('Sashi',15,4,'Virat Kohli','RCB','BA',9,''),
('Sashi',15,5,'Finn Allen','KKR','BA',8,'C'),
('Sashi',15,6,'Ramandeep Singh','KKR','BA',7.5,''),
('Sashi',15,7,'Abdul Samad','LSG','BA',7.5,'VC'),
('Sashi',15,8,'Ashutosh Sharma','DC','AL',7.5,''),
('Sashi',15,9,'Prince Yadav','LSG','BO',7,'BOI'),
('Sashi',15,10,'Yashasvi Jaiswal','RR','BA',9,''),
('Sashi',15,11,'Ayush Mhatre','CSK','BA',7,''),
('Tamil',15,1,'Finn Allen','KKR','BA',8,'VC'),
('Tamil',15,2,'Ishan Kishan','SRH','WK',9,''),
('Tamil',15,3,'Yashasvi Jaiswal','RR','BA',9,''),
('Tamil',15,4,'Ryan Rickelton','MI','WK',8,''),
('Tamil',15,5,'Aiden Markram','LSG','BA',9,''),
('Tamil',15,6,'Sai Sudharsan','GT','BA',8,''),
('Tamil',15,7,'Pathum Nissanka','DC','BA',8,''),
('Tamil',15,8,'Jasprit Bumrah','MI','BO',10,''),
('Tamil',15,9,'Mohammed Shami','LSG','BO',8,'BOI'),
('Tamil',15,10,'Glenn Phillips','GT','AL',8,''),
('Tamil',15,11,'Angkrish Raghuvanshi','KKR','BA',7.5,'C'),
('Bala',16,1,'Yashasvi Jaiswal','RR','BA',9,'BAI'),
('Bala',16,2,'Sandeep Sharma','RR','BO',8.5,''),
('Bala',16,3,'Jos Buttler','GT','WK',9.5,''),
('Bala',16,4,'Aiden Markram','LSG','BA',9,''),
('Bala',16,5,'Devdutt Padikkal','RCB','BA',8,'C'),
('Bala',16,6,'Sai Sudharsan','GT','BA',8,''),
('Bala',16,7,'Romario Shepherd','RCB','AL',8,''),
('Bala',16,8,'Sanju Samson','CSK','WK',8.5,''),
('Bala',16,9,'Axar Patel','DC','AL',8.5,''),
('Bala',16,10,'Virat Kohli','RCB','BA',9,'VC'),
('Bala',16,11,'Jasprit Bumrah','MI','BO',10,''),
('Jeba',16,1,'Yashasvi Jaiswal','RR','BA',9,'C'),
('Jeba',16,2,'Devdutt Padikkal','RCB','BA',8,'VC'),
('Jeba',16,3,'Finn Allen','KKR','BA',8,''),
('Jeba',16,4,'KL Rahul','DC','WK',9,''),
('Jeba',16,5,'Priyansh Arya','PBKS','BA',7.5,''),
('Jeba',16,6,'Virat Kohli','RCB','BA',9,'BAI'),
('Jeba',16,7,'Jacob Bethell','RCB','AL',7.5,''),
('Jeba',16,8,'Travis Head','SRH','BA',9,''),
('Jeba',16,9,'Vaibhav Sooryavanshi','RR','BA',8,''),
('Jeba',16,10,'Suyash Sharma','RCB','BO',7,''),
('Jeba',16,11,'Jofra Archer','RR','BO',8.5,''),
('Johny',16,1,'Yashasvi Jaiswal','RR','BA',9,'C'),
('Johny',16,2,'Avesh Khan','LSG','BO',8.5,''),
('Johny',16,3,'KL Rahul','DC','WK',9,''),
('Johny',16,4,'Krunal Pandya','RCB','AL',8.5,'VC'),
('Johny',16,5,'Travis Head','SRH','BA',9,''),
('Johny',16,6,'Vaibhav Sooryavanshi','RR','BA',8,''),
('Johny',16,7,'Heinrich Klaasen','SRH','WK',8.5,''),
('Johny',16,8,'Rajat Patidar','RCB','BA',8,'BAI'),
('Johny',16,9,'Virat Kohli','RCB','BA',9,''),
('Johny',16,10,'Ishan Kishan','SRH','WK',9,''),
('Johny',16,11,'Prasidh Krishna','GT','BO',8,''),
('Mansur',16,1,'Vaibhav Sooryavanshi','RR','BA',8,'BAI'),
('Mansur',16,2,'Virat Kohli','RCB','BA',9,''),
('Mansur',16,3,'Devdutt Padikkal','RCB','BA',8,''),
('Mansur',16,4,'Ravi Bishnoi','RR','BO',8.5,''),
('Mansur',16,5,'Shimron Hetmyer','RR','BA',8.5,'VC'),
('Mansur',16,6,'Tim David','RCB','BA',8.5,'C'),
('Mansur',16,7,'Digvesh Rathi','LSG','BO',7.5,''),
('Mansur',16,8,'Finn Allen','KKR','BA',8,''),
('Mansur',16,9,'KL Rahul','DC','WK',9,''),
('Mansur',16,10,'Khaleel Ahmed','CSK','BO',8,''),
('Mansur',16,11,'Abhishek Sharma','SRH','AL',8.5,''),
('Murali',16,1,'Pathum Nissanka','DC','BA',8,''),
('Murali',16,2,'Jacob Duffy','RCB','BO',8,''),
('Murali',16,3,'Ayush Mhatre','CSK','BA',7,''),
('Murali',16,4,'Marco Jansen','PBKS','AL',8.5,''),
('Murali',16,5,'Ravindra Jadeja','RR','AL',9,''),
('Murali',16,6,'Virat Kohli','RCB','BA',9,''),
('Murali',16,7,'Vaibhav Sooryavanshi','RR','BA',8,'C'),
('Murali',16,8,'Devdutt Padikkal','RCB','BA',8,'BAI'),
('Murali',16,9,'Bhuvneshwar Kumar','RCB','BO',9,'VC'),
('Murali',16,10,'Jitesh Sharma','RCB','WK',8.5,''),
('Murali',16,11,'Finn Allen','KKR','BA',8,''),
('Pandiyan',16,1,'Varun Chakravarthy','KKR','BO',8,''),
('Pandiyan',16,2,'Lhuan-dre Pretorius','RR','WK',7,''),
('Pandiyan',16,3,'Nicholas Pooran','LSG','WK',9.5,''),
('Pandiyan',16,4,'Vihaan Malhotra','RCB','AL',7,''),
('Pandiyan',16,5,'Aiden Markram','LSG','BA',9,''),
('Pandiyan',16,6,'Rajat Patidar','RCB','BA',8,''),
('Pandiyan',16,7,'Josh Hazlewood','RCB','BO',9,''),
('Pandiyan',16,8,'Virat Kohli','RCB','BA',9,'C'),
('Pandiyan',16,9,'Yashasvi Jaiswal','RR','BA',9,'VC'),
('Pandiyan',16,10,'Vaibhav Sooryavanshi','RR','BA',8,'BAI'),
('Pandiyan',16,11,'Nitish Kumar Reddy','SRH','AL',8.5,''),
('Saravana',16,1,'Devdutt Padikkal','RCB','BA',8,'BAI'),
('Saravana',16,2,'Vaibhav Sooryavanshi','RR','BA',8,'VC'),
('Saravana',16,3,'Mangesh Yadav','RCB','AL',7,''),
('Saravana',16,4,'Mohammed Shami','LSG','BO',8,''),
('Saravana',16,5,'Virat Kohli','RCB','BA',9,'C'),
('Saravana',16,6,'Ishan Kishan','SRH','WK',9,''),
('Saravana',16,7,'Rohit Sharma','MI','BA',9,''),
('Saravana',16,8,'Ruturaj Gaikwad','CSK','BA',9,''),
('Saravana',16,9,'Yashasvi Jaiswal','RR','BA',9,''),
('Saravana',16,10,'Sanju Samson','CSK','WK',8.5,''),
('Saravana',16,11,'Tushar Deshpande','RR','BO',8,''),
('Sashi',16,1,'Travis Head','SRH','BA',9,''),
('Sashi',16,2,'Heinrich Klaasen','SRH','WK',8.5,''),
('Sashi',16,3,'Rasikh Salam','RCB','BO',7,''),
('Sashi',16,4,'Finn Allen','KKR','BA',8,''),
('Sashi',16,5,'Virat Kohli','RCB','BA',9,'C'),
('Sashi',16,6,'Venkatesh Iyer','RCB','AL',8.5,''),
('Sashi',16,7,'Vaibhav Sooryavanshi','RR','BA',8,'VC'),
('Sashi',16,8,'Dhruv Jurel','RR','WK',8,''),
('Sashi',16,9,'Yashasvi Jaiswal','RR','BA',9,'BAI'),
('Sashi',16,10,'Prince Yadav','LSG','BO',7,''),
('Sashi',16,11,'Ayush Mhatre','CSK','BA',7,''),
('Tamil',16,1,'Virat Kohli','RCB','BA',9,'C'),
('Tamil',16,2,'Ishan Kishan','SRH','WK',9,''),
('Tamil',16,3,'Yashasvi Jaiswal','RR','BA',9,''),
('Tamil',16,4,'Phil Salt','RCB','WK',8.5,'VC'),
('Tamil',16,5,'Devdutt Padikkal','RCB','BA',8,''),
('Tamil',16,6,'Jacob Duffy','RCB','BO',8,''),
('Tamil',16,7,'Pathum Nissanka','DC','BA',8,''),
('Tamil',16,8,'Jasprit Bumrah','MI','BO',10,''),
('Tamil',16,9,'Vaibhav Sooryavanshi','RR','BA',8,'BAI'),
('Tamil',16,10,'Glenn Phillips','GT','AL',8,''),
('Tamil',16,11,'Riyan Parag','RR','BA',8.5,''),
('Bala',17,1,'Vijaykumar Vyshak','PBKS','BO',7.5,'BOI'),
('Bala',17,2,'Travis Head','SRH','BA',9,'VC'),
('Bala',17,3,'Jos Buttler','GT','WK',9.5,''),
('Bala',17,4,'Aiden Markram','LSG','BA',9,''),
('Bala',17,5,'Devdutt Padikkal','RCB','BA',8,''),
('Bala',17,6,'Sai Sudharsan','GT','BA',8,''),
('Bala',17,7,'Ishan Kishan','SRH','WK',9,'C'),
('Bala',17,8,'Sanju Samson','CSK','WK',8.5,''),
('Bala',17,9,'Axar Patel','DC','AL',8.5,''),
('Bala',17,10,'Virat Kohli','RCB','BA',9,''),
('Bala',17,11,'Jasprit Bumrah','MI','BO',10,''),
('Jeba',17,1,'Ishan Kishan','SRH','WK',9,'C'),
('Jeba',17,2,'Devdutt Padikkal','RCB','BA',8,''),
('Jeba',17,3,'Nitish Kumar Reddy','SRH','AL',8.5,''),
('Jeba',17,4,'KL Rahul','DC','WK',9,''),
('Jeba',17,5,'Priyansh Arya','PBKS','BA',7.5,'BAI'),
('Jeba',17,6,'Virat Kohli','RCB','BA',9,''),
('Jeba',17,7,'Heinrich Klaasen','SRH','WK',8.5,'VC'),
('Jeba',17,8,'Travis Head','SRH','BA',9,''),
('Jeba',17,9,'Vaibhav Sooryavanshi','RR','BA',8,''),
('Jeba',17,10,'Suyash Sharma','RCB','BO',7,''),
('Jeba',17,11,'Xavier Bartlett','PBKS','BO',7,''),
('Johny',17,1,'Shreyas Iyer','PBKS','BA',9,'C'),
('Johny',17,2,'Yuzvendra Chahal','PBKS','BO',8.5,'BOI'),
('Johny',17,3,'Cooper Connolly','PBKS','AL',7,''),
('Johny',17,4,'Abhishek Sharma','SRH','AL',8.5,''),
('Johny',17,5,'Travis Head','SRH','BA',9,''),
('Johny',17,6,'Prabhsimran Singh','PBKS','WK',8,''),
('Johny',17,7,'Heinrich Klaasen','SRH','WK',8.5,'VC'),
('Johny',17,8,'Nitish Kumar Reddy','SRH','AL',8.5,''),
('Johny',17,9,'Priyansh Arya','PBKS','BA',7.5,''),
('Johny',17,10,'Ishan Kishan','SRH','WK',9,''),
('Johny',17,11,'Vijaykumar Vyshak','PBKS','BO',7.5,''),
('Mansur',17,1,'Abhishek Sharma','SRH','AL',8.5,''),
('Mansur',17,2,'Marcus Stoinis','PBKS','AL',9.5,'VC'),
('Mansur',17,3,'Nitish Kumar Reddy','SRH','AL',8.5,'C'),
('Mansur',17,4,'Prabhsimran Singh','PBKS','WK',8,'BAI'),
('Mansur',17,5,'Vaibhav Sooryavanshi','RR','BA',8,''),
('Mansur',17,6,'Virat Kohli','RCB','BA',9,''),
('Mansur',17,7,'Devdutt Padikkal','RCB','BA',8,''),
('Mansur',17,8,'Digvesh Rathi','LSG','BO',7.5,''),
('Mansur',17,9,'Ishan Kishan','SRH','WK',9,''),
('Mansur',17,10,'KL Rahul','DC','WK',9,''),
('Mansur',17,11,'Khaleel Ahmed','CSK','BO',8,''),
('Murali',17,1,'Pathum Nissanka','DC','BA',8,''),
('Murali',17,2,'Jacob Duffy','RCB','BO',8,''),
('Murali',17,3,'Ayush Mhatre','CSK','BA',7,''),
('Murali',17,4,'Marco Jansen','PBKS','AL',8.5,'VC'),
('Murali',17,5,'Harshal Patel','SRH','BO',8.5,'BOI'),
('Murali',17,6,'Virat Kohli','RCB','BA',9,''),
('Murali',17,7,'Vaibhav Sooryavanshi','RR','BA',8,''),
('Murali',17,8,'Devdutt Padikkal','RCB','BA',8,''),
('Murali',17,9,'Ishan Kishan','SRH','WK',9,'C'),
('Murali',17,10,'Musheer Khan','PBKS','AL',7,''),
('Murali',17,11,'Finn Allen','KKR','BA',8,''),
('Pandiyan',17,1,'Nicholas Pooran','LSG','WK',9.5,''),
('Pandiyan',17,2,'Aiden Markram','LSG','BA',9,''),
('Pandiyan',17,3,'Nehal Wadhera','PBKS','BA',7.5,''),
('Pandiyan',17,4,'Harpreet Brar','PBKS','BO',8,''),
('Pandiyan',17,5,'Rajat Patidar','RCB','BA',8,''),
('Pandiyan',17,6,'Virat Kohli','RCB','BA',9,''),
('Pandiyan',17,7,'Vaibhav Sooryavanshi','RR','BA',8,''),
('Pandiyan',17,8,'Shreyas Iyer','PBKS','BA',9,'BAI'),
('Pandiyan',17,9,'Abhishek Sharma','SRH','AL',8.5,'C'),
('Pandiyan',17,10,'Krains Fuletra','SRH','BO',7,''),
('Pandiyan',17,11,'Nitish Kumar Reddy','SRH','AL',8.5,'VC'),
('Saravana',17,1,'Prabhsimran Singh','PBKS','WK',8,'C'),
('Saravana',17,2,'Vaibhav Sooryavanshi','RR','BA',8,''),
('Saravana',17,3,'Mangesh Yadav','RCB','AL',7,''),
('Saravana',17,4,'Mohammed Shami','LSG','BO',8,''),
('Saravana',17,5,'Virat Kohli','RCB','BA',9,''),
('Saravana',17,6,'Ishan Kishan','SRH','WK',9,'VC'),
('Saravana',17,7,'Rohit Sharma','MI','BA',9,''),
('Saravana',17,8,'Ruturaj Gaikwad','CSK','BA',9,''),
('Saravana',17,9,'Aniket Verma','SRH','BA',7.5,''),
('Saravana',17,10,'Sanju Samson','CSK','WK',8.5,''),
('Saravana',17,11,'Arshdeep Singh','PBKS','BO',9,'BOI'),
('Sashi',17,1,'Finn Allen','KKR','BA',8,''),
('Sashi',17,2,'Virat Kohli','RCB','BA',9,''),
('Sashi',17,3,'Yash Thakur','PBKS','BO',7.5,''),
('Sashi',17,4,'Shashank Singh','PBKS','AL',8,''),
('Sashi',17,5,'Heinrich Klaasen','SRH','WK',8.5,'C'),
('Sashi',17,6,'Salil Arora','SRH','WK',7,''),
('Sashi',17,7,'Priyansh Arya','PBKS','BA',7.5,'VC'),
('Sashi',17,8,'Yashasvi Jaiswal','RR','BA',9,''),
('Sashi',17,9,'Travis Head','SRH','BA',9,'BAI'),
('Sashi',17,10,'Eshan Malinga','SRH','BO',7,''),
('Sashi',17,11,'Ayush Mhatre','CSK','BA',7,''),
('Tamil',17,1,'Cooper Connolly','PBKS','AL',7,'BAI'),
('Tamil',17,2,'Ishan Kishan','SRH','WK',9,'C'),
('Tamil',17,3,'Yashasvi Jaiswal','RR','BA',9,''),
('Tamil',17,4,'Priyansh Arya','PBKS','BA',7.5,''),
('Tamil',17,5,'Devdutt Padikkal','RCB','BA',8,''),
('Tamil',17,6,'Kamindu Mendis','SRH','AL',8,''),
('Tamil',17,7,'Pathum Nissanka','DC','BA',8,''),
('Tamil',17,8,'Jasprit Bumrah','MI','BO',10,''),
('Tamil',17,9,'Travis Head','SRH','BA',9,''),
('Tamil',17,10,'Glenn Phillips','GT','AL',8,''),
('Tamil',17,11,'David Payne','SRH','BO',7,'VC'),
('Bala',18,1,'Mukesh Kumar','DC','BO',8,''),
('Bala',18,2,'Anshul Kamboj','CSK','AL',7,''),
('Bala',18,3,'KL Rahul','DC','WK',9,''),
('Bala',18,4,'David Miller','DC','BA',9,''),
('Bala',18,5,'Pathum Nissanka','DC','BA',8,'BAI'),
('Bala',18,6,'Sai Sudharsan','GT','BA',8,''),
('Bala',18,7,'Ayush Mhatre','CSK','BA',7,''),
('Bala',18,8,'Sanju Samson','CSK','WK',8.5,'C'),
('Bala',18,9,'Axar Patel','DC','AL',8.5,''),
('Bala',18,10,'Shivam Dube','CSK','AL',8.5,'VC'),
('Bala',18,11,'Jasprit Bumrah','MI','BO',10,''),
('Jeba',18,1,'Ishan Kishan','SRH','WK',9,''),
('Jeba',18,2,'Devdutt Padikkal','RCB','BA',8,''),
('Jeba',18,3,'Jamie Overton','CSK','AL',8,''),
('Jeba',18,4,'KL Rahul','DC','WK',9,'C'),
('Jeba',18,5,'Tristan Stubbs','DC','BA',8,'VC'),
('Jeba',18,6,'Virat Kohli','RCB','BA',9,''),
('Jeba',18,7,'Ruturaj Gaikwad','CSK','BA',9,'BAI'),
('Jeba',18,8,'Travis Head','SRH','BA',9,''),
('Jeba',18,9,'Vaibhav Sooryavanshi','RR','BA',8,''),
('Jeba',18,10,'Dushmantha Chameera','DC','BO',8,''),
('Jeba',18,11,'T Natarajan','DC','BO',8,''),
('Johny',18,1,'KL Rahul','DC','WK',9,'C'),
('Johny',18,2,'Akeal Hosein','CSK','BO',8,''),
('Johny',18,3,'Karun Nair','DC','BA',8,'VC'),
('Johny',18,4,'Abhishek Sharma','SRH','AL',8.5,''),
('Johny',18,5,'Travis Head','SRH','BA',9,''),
('Johny',18,6,'Ruturaj Gaikwad','CSK','BA',9,'BAI'),
('Johny',18,7,'Heinrich Klaasen','SRH','WK',8.5,''),
('Johny',18,8,'Nitish Kumar Reddy','SRH','AL',8.5,''),
('Johny',18,9,'Priyansh Arya','PBKS','BA',7.5,''),
('Johny',18,10,'Ishan Kishan','SRH','WK',9,''),
('Johny',18,11,'Vijaykumar Vyshak','PBKS','BO',7.5,''),
('Mansur',18,1,'KL Rahul','DC','WK',9,'C'),
('Mansur',18,2,'Khaleel Ahmed','CSK','BO',8,''),
('Mansur',18,3,'Dewald Brevis','CSK','BA',8,'BAI'),
('Mansur',18,4,'Sanju Samson','CSK','WK',8.5,'VC'),
('Mansur',18,5,'Abhishek Sharma','SRH','AL',8.5,''),
('Mansur',18,6,'Prabhsimran Singh','PBKS','WK',8,''),
('Mansur',18,7,'Vaibhav Sooryavanshi','RR','BA',8,''),
('Mansur',18,8,'Virat Kohli','RCB','BA',9,''),
('Mansur',18,9,'Devdutt Padikkal','RCB','BA',8,''),
('Mansur',18,10,'Digvesh Rathi','LSG','BO',7.5,''),
('Mansur',18,11,'Ishan Kishan','SRH','WK',9,''),
('Murali',18,1,'Pathum Nissanka','DC','BA',8,''),
('Murali',18,2,'Jacob Duffy','RCB','BO',8,''),
('Murali',18,3,'Ayush Mhatre','CSK','BA',7,''),
('Murali',18,4,'Sanju Samson','CSK','WK',8.5,'C'),
('Murali',18,5,'Kuldeep Yadav','DC','BO',8.5,'VC'),
('Murali',18,6,'Virat Kohli','RCB','BA',9,''),
('Murali',18,7,'Vaibhav Sooryavanshi','RR','BA',8,''),
('Murali',18,8,'Devdutt Padikkal','RCB','BA',8,''),
('Murali',18,9,'Ishan Kishan','SRH','WK',9,''),
('Murali',18,10,'Sameer Rizvi','DC','BA',7,'BAI'),
('Murali',18,11,'Musheer Khan','PBKS','AL',7,''),
('Pandiyan',18,1,'Dewald Brevis','CSK','BA',8,'VC'),
('Pandiyan',18,2,'Khaleel Ahmed','CSK','BO',8,''),
('Pandiyan',18,3,'Prashant Veer','CSK','AL',7,''),
('Pandiyan',18,4,'Lungi Ngidi','DC','BO',8,'BOI'),
('Pandiyan',18,5,'KL Rahul','DC','WK',9,'C'),
('Pandiyan',18,6,'Nicholas Pooran','LSG','WK',9.5,''),
('Pandiyan',18,7,'Aiden Markram','LSG','BA',9,''),
('Pandiyan',18,8,'Rajat Patidar','RCB','BA',8,''),
('Pandiyan',18,9,'Virat Kohli','RCB','BA',9,''),
('Pandiyan',18,10,'Vaibhav Sooryavanshi','RR','BA',8,''),
('Pandiyan',18,11,'Nitish Kumar Reddy','SRH','AL',8.5,''),
('Saravana',18,1,'KL Rahul','DC','WK',9,'C'),
('Saravana',18,2,'Vaibhav Sooryavanshi','RR','BA',8,''),
('Saravana',18,3,'Mangesh Yadav','RCB','AL',7,''),
('Saravana',18,4,'Mohammed Shami','LSG','BO',8,''),
('Saravana',18,5,'Virat Kohli','RCB','BA',9,''),
('Saravana',18,6,'Ishan Kishan','SRH','WK',9,''),
('Saravana',18,7,'Rohit Sharma','MI','BA',9,''),
('Saravana',18,8,'Ruturaj Gaikwad','CSK','BA',9,'VC'),
('Saravana',18,9,'Aniket Verma','SRH','BA',7.5,''),
('Saravana',18,10,'Sanju Samson','CSK','WK',8.5,'BAI'),
('Saravana',18,11,'Noor Ahmad','CSK','BO',8,''),
('Sashi',18,1,'Finn Allen','KKR','BA',8,''),
('Sashi',18,2,'Virat Kohli','RCB','BA',9,''),
('Sashi',18,3,'Yash Thakur','PBKS','BO',7.5,''),
('Sashi',18,4,'Heinrich Klaasen','SRH','WK',8.5,''),
('Sashi',18,5,'Axar Patel','DC','AL',8.5,'C'),
('Sashi',18,6,'Ashutosh Sharma','DC','AL',7.5,''),
('Sashi',18,7,'Ayush Mhatre','CSK','BA',7,'VC'),
('Sashi',18,8,'Yashasvi Jaiswal','RR','BA',9,''),
('Sashi',18,9,'Dewald Brevis','CSK','BA',8,'BAI'),
('Sashi',18,10,'Eshan Malinga','SRH','BO',7,''),
('Sashi',18,11,'Travis Head','SRH','BA',9,''),
('Tamil',18,1,'KL Rahul','DC','WK',9,'BAI'),
('Tamil',18,2,'Sameer Rizvi','DC','BA',7,'VC'),
('Tamil',18,3,'Yashasvi Jaiswal','RR','BA',9,''),
('Tamil',18,4,'Priyansh Arya','PBKS','BA',7.5,''),
('Tamil',18,5,'Devdutt Padikkal','RCB','BA',8,''),
('Tamil',18,6,'Matt Henry','CSK','BO',8,''),
('Tamil',18,7,'Pathum Nissanka','DC','BA',8,''),
('Tamil',18,8,'Jasprit Bumrah','MI','BO',10,''),
('Tamil',18,9,'Sanju Samson','CSK','WK',8.5,''),
('Tamil',18,10,'Glenn Phillips','GT','AL',8,''),
('Tamil',18,11,'Sarfaraz Khan','CSK','BA',7,'C'),
('Bala',19,1,'Mukesh Kumar','DC','BO',8,''),
('Bala',19,2,'Ayush Badoni','LSG','BA',7.5,''),
('Bala',19,3,'Jos Buttler','GT','WK',9.5,'C'),
('Bala',19,4,'Nicholas Pooran','LSG','WK',9.5,'VC'),
('Bala',19,5,'Pathum Nissanka','DC','BA',8,''),
('Bala',19,6,'Sai Sudharsan','GT','BA',8,'BAI'),
('Bala',19,7,'Rahul Tewatia','GT','AL',8,''),
('Bala',19,8,'Sanju Samson','CSK','WK',8.5,''),
('Bala',19,9,'Axar Patel','DC','AL',8.5,''),
('Bala',19,10,'Shivam Dube','CSK','AL',8.5,''),
('Bala',19,11,'Jasprit Bumrah','MI','BO',10,''),
('Jeba',19,1,'Ishan Kishan','SRH','WK',9,''),
('Jeba',19,2,'Devdutt Padikkal','RCB','BA',8,''),
('Jeba',19,3,'Rishabh Pant','LSG','WK',9,'VC'),
('Jeba',19,4,'KL Rahul','DC','WK',9,''),
('Jeba',19,5,'Aiden Markram','LSG','BA',9,'C'),
('Jeba',19,6,'Virat Kohli','RCB','BA',9,''),
('Jeba',19,7,'Mitchell Marsh','LSG','AL',9,'BAI'),
('Jeba',19,8,'Travis Head','SRH','BA',9,''),
('Jeba',19,9,'Vaibhav Sooryavanshi','RR','BA',8,''),
('Jeba',19,10,'Ashok Sharma','GT','BO',7,''),
('Jeba',19,11,'Mohammed Shami','LSG','BO',8,''),
('Johny',19,1,'Mitchell Marsh','LSG','AL',9,'VC'),
('Johny',19,2,'Avesh Khan','LSG','BO',8.5,''),
('Johny',19,3,'Jos Buttler','GT','WK',9.5,'C'),
('Johny',19,4,'Abhishek Sharma','SRH','AL',8.5,''),
('Johny',19,5,'Travis Head','SRH','BA',9,''),
('Johny',19,6,'Ruturaj Gaikwad','CSK','BA',9,''),
('Johny',19,7,'Heinrich Klaasen','SRH','WK',8.5,''),
('Johny',19,8,'Nitish Kumar Reddy','SRH','AL',8.5,''),
('Johny',19,9,'Priyansh Arya','PBKS','BA',7.5,''),
('Johny',19,10,'Ishan Kishan','SRH','WK',9,''),
('Johny',19,11,'Prasidh Krishna','GT','BO',8,'BOI'),
('Mansur',19,1,'Digvesh Rathi','LSG','BO',7.5,''),
('Mansur',19,2,'Rishabh Pant','LSG','WK',9,'C'),
('Mansur',19,3,'Shubman Gill','GT','BA',9,'VC'),
('Mansur',19,4,'Mohammed Siraj','GT','BO',8.5,'BOI'),
('Mansur',19,5,'Mitchell Marsh','LSG','AL',9,''),
('Mansur',19,6,'Sanju Samson','CSK','WK',8.5,''),
('Mansur',19,7,'Abhishek Sharma','SRH','AL',8.5,''),
('Mansur',19,8,'Ishan Kishan','SRH','WK',9,''),
('Mansur',19,9,'Vaibhav Sooryavanshi','RR','BA',8,''),
('Mansur',19,10,'Virat Kohli','RCB','BA',9,''),
('Mansur',19,11,'Devdutt Padikkal','RCB','BA',8,''),
('Murali',19,1,'Pathum Nissanka','DC','BA',8,''),
('Murali',19,2,'Jacob Duffy','RCB','BO',8,''),
('Murali',19,3,'Ayush Mhatre','CSK','BA',7,''),
('Murali',19,4,'Glenn Phillips','GT','AL',8,'VC'),
('Murali',19,5,'Prasidh Krishna','GT','BO',8,'BOI'),
('Murali',19,6,'Virat Kohli','RCB','BA',9,''),
('Murali',19,7,'Vaibhav Sooryavanshi','RR','BA',8,''),
('Murali',19,8,'Devdutt Padikkal','RCB','BA',8,''),
('Murali',19,9,'Ishan Kishan','SRH','WK',9,''),
('Murali',19,10,'Nicholas Pooran','LSG','WK',9.5,'C'),
('Murali',19,11,'Mayank Yadav','LSG','BO',7,''),
('Pandiyan',19,1,'Dewald Brevis','CSK','BA',8,''),
('Pandiyan',19,2,'Washington Sundar','GT','AL',8,'VC'),
('Pandiyan',19,3,'Mukul Choudhary','LSG','BA',7,''),
('Pandiyan',19,4,'Mitchell Marsh','LSG','AL',9,'BAI'),
('Pandiyan',19,5,'Mohsin Khan','LSG','BO',7.5,''),
('Pandiyan',19,6,'Nicholas Pooran','LSG','WK',9.5,''),
('Pandiyan',19,7,'Aiden Markram','LSG','BA',9,'C'),
('Pandiyan',19,8,'Shardul Thakur','MI','BO',8,''),
('Pandiyan',19,9,'Rajat Patidar','RCB','BA',8,''),
('Pandiyan',19,10,'Virat Kohli','RCB','BA',9,''),
('Pandiyan',19,11,'Vaibhav Sooryavanshi','RR','BA',8,''),
('Saravana',19,1,'Jos Buttler','GT','WK',9.5,'VC'),
('Saravana',19,2,'Vaibhav Sooryavanshi','RR','BA',8,''),
('Saravana',19,3,'Mangesh Yadav','RCB','AL',7,''),
('Saravana',19,4,'Mohammed Shami','LSG','BO',8,'BOI'),
('Saravana',19,5,'Virat Kohli','RCB','BA',9,''),
('Saravana',19,6,'Ishan Kishan','SRH','WK',9,''),
('Saravana',19,7,'Rohit Sharma','MI','BA',9,''),
('Saravana',19,8,'Ruturaj Gaikwad','CSK','BA',9,''),
('Saravana',19,9,'Sai Sudharsan','GT','BA',8,'C'),
('Saravana',19,10,'Sanju Samson','CSK','WK',8.5,''),
('Saravana',19,11,'Digvesh Rathi','LSG','BO',7.5,''),
('Sashi',19,1,'Finn Allen','KKR','BA',8,''),
('Sashi',19,2,'Virat Kohli','RCB','BA',9,''),
('Sashi',19,3,'Abdul Samad','LSG','BA',7.5,''),
('Sashi',19,4,'Heinrich Klaasen','SRH','WK',8.5,''),
('Sashi',19,5,'Rashid Khan','GT','AL',9.5,'C'),
('Sashi',19,6,'Ayush Mhatre','CSK','BA',7,''),
('Sashi',19,7,'Prince Yadav','LSG','BO',7,'VC'),
('Sashi',19,8,'Yashasvi Jaiswal','RR','BA',9,''),
('Sashi',19,9,'Kagiso Rabada','GT','BO',8.5,'BOI'),
('Sashi',19,10,'Eshan Malinga','SRH','BO',7,''),
('Sashi',19,11,'Travis Head','SRH','BA',9,''),
('Tamil',19,1,'Jayant Yadav','GT','BO',8,''),
('Tamil',19,2,'Aiden Markram','LSG','BA',9,''),
('Tamil',19,3,'Yashasvi Jaiswal','RR','BA',9,''),
('Tamil',19,4,'Priyansh Arya','PBKS','BA',7.5,''),
('Tamil',19,5,'Devdutt Padikkal','RCB','BA',8,''),
('Tamil',19,6,'George Linde','LSG','AL',7,'C'),
('Tamil',19,7,'Pathum Nissanka','DC','BA',8,''),
('Tamil',19,8,'Jasprit Bumrah','MI','BO',10,''),
('Tamil',19,9,'Sanju Samson','CSK','WK',8.5,''),
('Tamil',19,10,'Glenn Phillips','GT','AL',8,'VC'),
('Tamil',19,11,'Sai Sudharsan','GT','BA',8,'BAI'),
('Bala',20,1,'Trent Boult','MI','BO',9,''),
('Bala',20,2,'Romario Shepherd','RCB','AL',8,''),
('Bala',20,3,'Jos Buttler','GT','WK',9.5,''),
('Bala',20,4,'Nicholas Pooran','LSG','WK',9.5,''),
('Bala',20,5,'Mitchell Santner','MI','AL',9,'C'),
('Bala',20,6,'Sai Sudharsan','GT','BA',8,''),
('Bala',20,7,'Tilak Varma','MI','AL',8.5,'BAI'),
('Bala',20,8,'Sanju Samson','CSK','WK',8.5,''),
('Bala',20,9,'Axar Patel','DC','AL',8.5,''),
('Bala',20,10,'Devdutt Padikkal','RCB','BA',8,'VC'),
('Bala',20,11,'Jasprit Bumrah','MI','BO',10,''),
('Jeba',20,1,'Ishan Kishan','SRH','WK',9,''),
('Jeba',20,2,'Devdutt Padikkal','RCB','BA',8,'BAI'),
('Jeba',20,3,'Rishabh Pant','LSG','WK',9,''),
('Jeba',20,4,'Rajat Patidar','RCB','BA',8,''),
('Jeba',20,5,'Ryan Rickelton','MI','WK',8,'C'),
('Jeba',20,6,'Virat Kohli','RCB','BA',9,'VC'),
('Jeba',20,7,'Mitchell Marsh','LSG','AL',9,''),
('Jeba',20,8,'Travis Head','SRH','BA',9,''),
('Jeba',20,9,'Vaibhav Sooryavanshi','RR','BA',8,''),
('Jeba',20,10,'Ashok Sharma','GT','BO',7,''),
('Jeba',20,11,'Suyash Sharma','RCB','BO',7,''),
('Johny',20,1,'Krunal Pandya','RCB','AL',8.5,'VC'),
('Johny',20,2,'Avesh Khan','LSG','BO',8.5,''),
('Johny',20,3,'Rajat Patidar','RCB','BA',8,'C'),
('Johny',20,4,'Abhishek Sharma','SRH','AL',8.5,''),
('Johny',20,5,'Travis Head','SRH','BA',9,''),
('Johny',20,6,'Ruturaj Gaikwad','CSK','BA',9,''),
('Johny',20,7,'Heinrich Klaasen','SRH','WK',8.5,''),
('Johny',20,8,'Rohit Sharma','MI','BA',9,''),
('Johny',20,9,'Virat Kohli','RCB','BA',9,'BAI'),
('Johny',20,10,'Ishan Kishan','SRH','WK',9,''),
('Johny',20,11,'Prasidh Krishna','GT','BO',8,''),
('Mansur',20,1,'Virat Kohli','RCB','BA',9,'C'),
('Mansur',20,2,'Devdutt Padikkal','RCB','BA',8,''),
('Mansur',20,3,'Tim David','RCB','BA',8.5,'VC'),
('Mansur',20,4,'Jasprit Bumrah','MI','BO',10,''),
('Mansur',20,5,'Rohit Sharma','MI','BA',9,'BAI'),
('Mansur',20,6,'Hardik Pandya','MI','AL',11,''),
('Mansur',20,7,'Sanju Samson','CSK','WK',8.5,''),
('Mansur',20,8,'Abhishek Sharma','SRH','AL',8.5,''),
('Mansur',20,9,'Ishan Kishan','SRH','WK',9,''),
('Mansur',20,10,'Digvesh Rathi','LSG','BO',7.5,''),
('Mansur',20,11,'Vaibhav Sooryavanshi','RR','BA',8,''),
('Murali',20,1,'Pathum Nissanka','DC','BA',8,''),
('Murali',20,2,'Mayank Yadav','LSG','BO',7,''),
('Murali',20,3,'Ayush Mhatre','CSK','BA',7,''),
('Murali',20,4,'Suryakumar Yadav','MI','BA',10,'C'),
('Murali',20,5,'Bhuvneshwar Kumar','RCB','BO',9,''),
('Murali',20,6,'Virat Kohli','RCB','BA',9,'VC'),
('Murali',20,7,'Vaibhav Sooryavanshi','RR','BA',8,''),
('Murali',20,8,'Devdutt Padikkal','RCB','BA',8,'BAI'),
('Murali',20,9,'Ishan Kishan','SRH','WK',9,''),
('Murali',20,10,'Jitesh Sharma','RCB','WK',8.5,''),
('Murali',20,11,'Musheer Khan','PBKS','AL',7,''),
('Pandiyan',20,1,'Dewald Brevis','CSK','BA',8,''),
('Pandiyan',20,2,'Mitchell Marsh','LSG','AL',9,''),
('Pandiyan',20,3,'Nicholas Pooran','LSG','WK',9.5,''),
('Pandiyan',20,4,'Aiden Markram','LSG','BA',9,''),
('Pandiyan',20,5,'Suryakumar Yadav','MI','BA',10,'BAI'),
('Pandiyan',20,6,'Shardul Thakur','MI','BO',8,''),
('Pandiyan',20,7,'Romario Shepherd','RCB','AL',8,''),
('Pandiyan',20,8,'Josh Hazlewood','RCB','BO',9,''),
('Pandiyan',20,9,'Rajat Patidar','RCB','BA',8,'VC'),
('Pandiyan',20,10,'Virat Kohli','RCB','BA',9,'C'),
('Pandiyan',20,11,'Vaibhav Sooryavanshi','RR','BA',8,''),
('Saravana',20,1,'Jos Buttler','GT','WK',9.5,''),
('Saravana',20,2,'Vaibhav Sooryavanshi','RR','BA',8,''),
('Saravana',20,3,'Hardik Pandya','MI','AL',11,'C'),
('Saravana',20,4,'Mohammed Shami','LSG','BO',8,''),
('Saravana',20,5,'Virat Kohli','RCB','BA',9,'BAI'),
('Saravana',20,6,'Ishan Kishan','SRH','WK',9,''),
('Saravana',20,7,'Rohit Sharma','MI','BA',9,''),
('Saravana',20,8,'Ruturaj Gaikwad','CSK','BA',9,''),
('Saravana',20,9,'Devdutt Padikkal','RCB','BA',8,'VC'),
('Saravana',20,10,'Sanju Samson','CSK','WK',8.5,''),
('Saravana',20,11,'Deepak Chahar','MI','BO',8.5,''),
('Sashi',20,1,'Finn Allen','KKR','BA',8,''),
('Sashi',20,2,'Naman Dhir','MI','BA',7,''),
('Sashi',20,3,'Rasikh Salam','RCB','BO',7,''),
('Sashi',20,4,'Heinrich Klaasen','SRH','WK',8.5,''),
('Sashi',20,5,'Virat Kohli','RCB','BA',9,'C'),
('Sashi',20,6,'Ayush Mhatre','CSK','BA',7,''),
('Sashi',20,7,'Tilak Varma','MI','AL',8.5,'VC'),
('Sashi',20,8,'Yashasvi Jaiswal','RR','BA',9,''),
('Sashi',20,9,'Suryakumar Yadav','MI','BA',10,'BAI'),
('Sashi',20,10,'AM Ghazanfar','MI','BO',7,''),
('Sashi',20,11,'Travis Head','SRH','BA',9,''),
('Tamil',20,1,'Virat Kohli','RCB','BA',9,'C'),
('Tamil',20,2,'Aiden Markram','LSG','BA',9,''),
('Tamil',20,3,'Yashasvi Jaiswal','RR','BA',9,''),
('Tamil',20,4,'Mayank Markande','MI','BO',7.5,''),
('Tamil',20,5,'Devdutt Padikkal','RCB','BA',8,''),
('Tamil',20,6,'Rohit Sharma','MI','BA',9,'BAI'),
('Tamil',20,7,'Sherfane Rutherford','MI','BA',8,''),
('Tamil',20,8,'Jasprit Bumrah','MI','BO',10,''),
('Tamil',20,9,'Sanju Samson','CSK','WK',8.5,''),
('Tamil',20,10,'Glenn Phillips','GT','AL',8,''),
('Tamil',20,11,'Phil Salt','RCB','WK',8.5,'VC');

create temporary table vt_points(
  match_number integer,
  player_name text,
  team_code text,
  batting numeric,
  bowling numeric,
  fielding numeric,
  total numeric,
  source_tab text
) on commit drop;

insert into vt_points values
(11,'Anshul Kamboj','CSK',30,24,0,54,'M11_RCB_vs_CSK'),
(11,'Ayush Mhatre','CSK',1,0,0,1,'M11_RCB_vs_CSK'),
(11,'Jamie Overton','CSK',69,28,0,97,'M11_RCB_vs_CSK'),
(11,'Kartik Sharma','CSK',8,0,0,8,'M11_RCB_vs_CSK'),
(11,'Khaleel Ahmed','CSK',0,12,0,12,'M11_RCB_vs_CSK'),
(11,'Matt Henry','CSK',2,-6,0,-4,'M11_RCB_vs_CSK'),
(11,'Noor Ahmad','CSK',10,0,10,20,'M11_RCB_vs_CSK'),
(11,'Prashant Veer','CSK',57,0,0,57,'M11_RCB_vs_CSK'),
(11,'Ruturaj Gaikwad','CSK',9,0,0,9,'M11_RCB_vs_CSK'),
(11,'Sanju Samson','CSK',11,0,0,11,'M11_RCB_vs_CSK'),
(11,'Sarfaraz Khan','CSK',82,0,0,82,'M11_RCB_vs_CSK'),
(11,'Shivam Dube','CSK',26,12,10,48,'M11_RCB_vs_CSK'),
(11,'Abhinandan Singh','RCB',0,47,10,59,'M11_RCB_vs_CSK'),
(11,'Bhuvneshwar Kumar','RCB',0,79,0,81,'M11_RCB_vs_CSK'),
(11,'Devdutt Padikkal','RCB',73,0,20,95,'M11_RCB_vs_CSK'),
(11,'Jacob Duffy','RCB',0,44,0,46,'M11_RCB_vs_CSK'),
(11,'Jitesh Sharma','RCB',0,0,20,22,'M11_RCB_vs_CSK'),
(11,'Krunal Pandya','RCB',0,48,0,50,'M11_RCB_vs_CSK'),
(11,'Phil Salt','RCB',63,0,0,65,'M11_RCB_vs_CSK'),
(11,'Rajat Patidar','RCB',85,0,20,107,'M11_RCB_vs_CSK'),
(11,'Romario Shepherd','RCB',0,-12,0,-10,'M11_RCB_vs_CSK'),
(11,'Suyash Sharma','RCB',0,42,0,44,'M11_RCB_vs_CSK'),
(11,'Tim David','RCB',127,0,0,144,'M11_RCB_vs_CSK'),
(11,'Virat Kohli','RCB',42,0,10,54,'M11_RCB_vs_CSK'),
(13,'AM Ghazanfar','MI',0,56,0,56,'M13_RR_vs_MI'),
(13,'Deepak Chahar','MI',7,-10,0,-3,'M13_RR_vs_MI'),
(13,'Hardik Pandya','MI',11,2,0,13,'M13_RR_vs_MI'),
(13,'Jasprit Bumrah','MI',6,4,0,10,'M13_RR_vs_MI'),
(13,'Naman Dhir','MI',46,0,0,46,'M13_RR_vs_MI'),
(13,'Rohit Sharma','MI',5,0,0,5,'M13_RR_vs_MI'),
(13,'Ryan Rickelton','MI',10,0,0,10,'M13_RR_vs_MI'),
(13,'Shardul Thakur','MI',9,12,0,21,'M13_RR_vs_MI'),
(13,'Sherfane Rutherford','MI',65,0,0,65,'M13_RR_vs_MI'),
(13,'Suryakumar Yadav','MI',8,0,0,8,'M13_RR_vs_MI'),
(13,'Tilak Varma','MI',20,0,20,40,'M13_RR_vs_MI'),
(13,'Trent Boult','MI',1,-12,0,-11,'M13_RR_vs_MI'),
(13,'Dhruv Jurel','RR',2,0,20,24,'M13_RR_vs_MI'),
(13,'Donovan Ferreira','RR',0,0,0,2,'M13_RR_vs_MI'),
(13,'Jofra Archer','RR',0,24,20,46,'M13_RR_vs_MI'),
(13,'Nandre Burger','RR',0,50,0,52,'M13_RR_vs_MI'),
(13,'Ravi Bishnoi','RR',0,38,10,50,'M13_RR_vs_MI'),
(13,'Ravindra Jadeja','RR',0,0,0,2,'M13_RR_vs_MI'),
(13,'Riyan Parag','RR',39,0,0,41,'M13_RR_vs_MI'),
(13,'Sandeep Sharma','RR',0,63,10,75,'M13_RR_vs_MI'),
(13,'Shimron Hetmyer','RR',6,0,10,18,'M13_RR_vs_MI'),
(13,'Tushar Deshpande','RR',0,14,0,16,'M13_RR_vs_MI'),
(13,'Vaibhav Sooryavanshi','RR',84,0,0,86,'M13_RR_vs_MI'),
(13,'Yashasvi Jaiswal','RR',129,0,10,156,'M13_RR_vs_MI'),
(14,'Axar Patel','DC',2,-2,0,0,'M14_DC_vs_GT'),
(14,'David Miller','DC',66,0,0,66,'M14_DC_vs_GT'),
(14,'KL Rahul','DC',137,0,0,137,'M14_DC_vs_GT'),
(14,'Kuldeep Yadav','DC',1,36,0,37,'M14_DC_vs_GT'),
(14,'Lungi Ngidi','DC',0,44,0,44,'M14_DC_vs_GT'),
(14,'Mukesh Kumar','DC',0,60,0,60,'M14_DC_vs_GT'),
(14,'Nitish Rana','DC',6,0,20,26,'M14_DC_vs_GT'),
(14,'Pathum Nissanka','DC',59,0,0,59,'M14_DC_vs_GT'),
(14,'Sameer Rizvi','DC',-4,0,0,-4,'M14_DC_vs_GT'),
(14,'T Natarajan','DC',0,2,0,2,'M14_DC_vs_GT'),
(14,'Tristan Stubbs','DC',7,0,0,7,'M14_DC_vs_GT'),
(14,'Vipraj Nigam','DC',14,-10,0,4,'M14_DC_vs_GT'),
(14,'Ashok Sharma','GT',0,-10,0,-8,'M14_DC_vs_GT'),
(14,'Glenn Phillips','GT',17,0,10,29,'M14_DC_vs_GT'),
(14,'Jos Buttler','GT',85,0,20,107,'M14_DC_vs_GT'),
(14,'Kagiso Rabada','GT',0,12,0,14,'M14_DC_vs_GT'),
(14,'M Shahrukh Khan','GT',0,0,0,2,'M14_DC_vs_GT'),
(14,'Mohammed Siraj','GT',0,28,0,30,'M14_DC_vs_GT'),
(14,'Prasidh Krishna','GT',0,43,0,45,'M14_DC_vs_GT'),
(14,'Rahul Tewatia','GT',1,0,10,13,'M14_DC_vs_GT'),
(14,'Rashid Khan','GT',0,104,0,121,'M14_DC_vs_GT'),
(14,'Sai Sudharsan','GT',14,0,20,36,'M14_DC_vs_GT'),
(14,'Shubman Gill','GT',98,0,10,110,'M14_DC_vs_GT'),
(14,'Washington Sundar','GT',79,-2,0,79,'M14_DC_vs_GT'),
(15,'Ajinkya Rahane','KKR',59,0,0,59,'M15_KKR_vs_LSG'),
(15,'Angkrish Raghuvanshi','KKR',60,0,10,70,'M15_KKR_vs_LSG'),
(15,'Anukul Roy','KKR',0,68,10,78,'M15_KKR_vs_LSG'),
(15,'Cameron Green','KKR',43,16,0,59,'M15_KKR_vs_LSG'),
(15,'Finn Allen','KKR',11,0,0,11,'M15_KKR_vs_LSG'),
(15,'Kartik Tyagi','KKR',0,28,10,38,'M15_KKR_vs_LSG'),
(15,'Navdeep Saini','KKR',0,2,0,2,'M15_KKR_vs_LSG'),
(15,'Ramandeep Singh','KKR',0,0,10,10,'M15_KKR_vs_LSG'),
(15,'Rinku Singh','KKR',4,0,10,14,'M15_KKR_vs_LSG'),
(15,'Rovman Powell','KKR',57,0,10,67,'M15_KKR_vs_LSG'),
(15,'Sunil Narine','KKR',0,57,0,57,'M15_KKR_vs_LSG'),
(15,'Vaibhav Arora','KKR',0,64,0,64,'M15_KKR_vs_LSG'),
(15,'Abdul Samad','LSG',2,0,0,4,'M15_KKR_vs_LSG'),
(15,'Aiden Markram','LSG',30,0,10,42,'M15_KKR_vs_LSG'),
(15,'Avesh Khan','LSG',1,46,0,49,'M15_KKR_vs_LSG'),
(15,'Ayush Badoni','LSG',79,0,0,81,'M15_KKR_vs_LSG'),
(15,'Digvesh Rathi','LSG',0,40,10,52,'M15_KKR_vs_LSG'),
(15,'Manimaran Siddharth','LSG',0,36,0,38,'M15_KKR_vs_LSG'),
(15,'Mitchell Marsh','LSG',22,0,0,24,'M15_KKR_vs_LSG'),
(15,'Mohammed Shami','LSG',1,16,10,29,'M15_KKR_vs_LSG'),
(15,'Mukul Choudhary','LSG',90,0,0,107,'M15_KKR_vs_LSG'),
(15,'Nicholas Pooran','LSG',13,0,0,15,'M15_KKR_vs_LSG'),
(15,'Prince Yadav','LSG',0,28,0,30,'M15_KKR_vs_LSG'),
(15,'Rishabh Pant','LSG',11,0,0,13,'M15_KKR_vs_LSG'),
(16,'Abhinandan Singh','RCB',0,-10,0,-10,'M16_RR_vs_RCB'),
(16,'Bhuvneshwar Kumar','RCB',10,12,0,22,'M16_RR_vs_RCB'),
(16,'Devdutt Padikkal','RCB',17,0,0,17,'M16_RR_vs_RCB'),
(16,'Jitesh Sharma','RCB',5,0,10,15,'M16_RR_vs_RCB'),
(16,'Josh Hazlewood','RCB',0,54,10,64,'M16_RR_vs_RCB'),
(16,'Krunal Pandya','RCB',1,56,10,67,'M16_RR_vs_RCB'),
(16,'Phil Salt','RCB',-4,0,0,-4,'M16_RR_vs_RCB'),
(16,'Rajat Patidar','RCB',89,0,0,89,'M16_RR_vs_RCB'),
(16,'Romario Shepherd','RCB',40,-4,0,36,'M16_RR_vs_RCB'),
(16,'Tim David','RCB',15,-10,0,5,'M16_RR_vs_RCB'),
(16,'Venkatesh Iyer','RCB',50,0,0,50,'M16_RR_vs_RCB'),
(16,'Virat Kohli','RCB',55,0,10,65,'M16_RR_vs_RCB'),
(16,'Brijesh Sharma','RR',0,58,10,70,'M16_RR_vs_RCB'),
(16,'Dhruv Jurel','RR',121,0,10,133,'M16_RR_vs_RCB'),
(16,'Donovan Ferreira','RR',0,0,10,12,'M16_RR_vs_RCB'),
(16,'Jofra Archer','RR',0,50,0,52,'M16_RR_vs_RCB'),
(16,'Nandre Burger','RR',0,8,0,10,'M16_RR_vs_RCB'),
(16,'Ravi Bishnoi','RR',0,66,0,68,'M16_RR_vs_RCB'),
(16,'Ravindra Jadeja','RR',25,24,0,51,'M16_RR_vs_RCB'),
(16,'Riyan Parag','RR',3,0,0,5,'M16_RR_vs_RCB'),
(16,'Sandeep Sharma','RR',0,30,0,32,'M16_RR_vs_RCB'),
(16,'Shimron Hetmyer','RR',-4,0,30,28,'M16_RR_vs_RCB'),
(16,'Vaibhav Sooryavanshi','RR',144,0,0,161,'M16_RR_vs_RCB'),
(16,'Yashasvi Jaiswal','RR',17,0,0,19,'M16_RR_vs_RCB'),
(17,'Arshdeep Singh','PBKS',0,54,10,66,'M17_PBKS_vs_SRH'),
(17,'Cooper Connolly','PBKS',12,0,10,24,'M17_PBKS_vs_SRH'),
(17,'Marco Jansen','PBKS',0,2,10,14,'M17_PBKS_vs_SRH'),
(17,'Marcus Stoinis','PBKS',0,0,10,12,'M17_PBKS_vs_SRH'),
(17,'Nehal Wadhera','PBKS',18,0,0,20,'M17_PBKS_vs_SRH'),
(17,'Prabhsimran Singh','PBKS',83,0,10,95,'M17_PBKS_vs_SRH'),
(17,'Priyansh Arya','PBKS',110,0,0,112,'M17_PBKS_vs_SRH'),
(17,'Shashank Singh','PBKS',19,58,0,79,'M17_PBKS_vs_SRH'),
(17,'Shreyas Iyer','PBKS',104,0,0,121,'M17_PBKS_vs_SRH'),
(17,'Vijaykumar Vyshak','PBKS',0,-8,0,-6,'M17_PBKS_vs_SRH'),
(17,'Xavier Bartlett','PBKS',0,26,20,48,'M17_PBKS_vs_SRH'),
(17,'Yuzvendra Chahal','PBKS',0,0,0,2,'M17_PBKS_vs_SRH'),
(17,'Abhishek Sharma','SRH',123,2,0,125,'M17_PBKS_vs_SRH'),
(17,'Aniket Verma','SRH',21,0,10,31,'M17_PBKS_vs_SRH'),
(17,'Eshan Malinga','SRH',0,-2,0,-2,'M17_PBKS_vs_SRH'),
(17,'Harsh Dubey','SRH',1,38,0,39,'M17_PBKS_vs_SRH'),
(17,'Harshal Patel','SRH',0,-10,0,-10,'M17_PBKS_vs_SRH'),
(17,'Heinrich Klaasen','SRH',46,0,10,56,'M17_PBKS_vs_SRH'),
(17,'Ishan Kishan','SRH',42,0,0,42,'M17_PBKS_vs_SRH'),
(17,'Jaydev Unadkat','SRH',0,-2,0,-2,'M17_PBKS_vs_SRH'),
(17,'Nitish Kumar Reddy','SRH',0,-4,10,6,'M17_PBKS_vs_SRH'),
(17,'Salil Arora','SRH',11,0,0,11,'M17_PBKS_vs_SRH'),
(17,'Shivang Kumar','SRH',0,80,0,80,'M17_PBKS_vs_SRH'),
(17,'Travis Head','SRH',55,0,0,55,'M17_PBKS_vs_SRH'),
(18,'Akeal Hosein','CSK',0,6,10,18,'M18_CSK_vs_DC'),
(18,'Anshul Kamboj','CSK',0,76,10,88,'M18_CSK_vs_DC'),
(18,'Ayush Mhatre','CSK',84,0,0,86,'M18_CSK_vs_DC'),
(18,'Dewald Brevis','CSK',0,0,30,32,'M18_CSK_vs_DC'),
(18,'Gurjapneet Singh','CSK',0,34,10,46,'M18_CSK_vs_DC'),
(18,'Jamie Overton','CSK',0,131,10,143,'M18_CSK_vs_DC'),
(18,'Khaleel Ahmed','CSK',0,18,0,20,'M18_CSK_vs_DC'),
(18,'Noor Ahmad','CSK',0,20,10,32,'M18_CSK_vs_DC'),
(18,'Ruturaj Gaikwad','CSK',14,0,0,16,'M18_CSK_vs_DC'),
(18,'Sanju Samson','CSK',172,0,0,189,'M18_CSK_vs_DC'),
(18,'Sarfaraz Khan','CSK',0,0,10,12,'M18_CSK_vs_DC'),
(18,'Shivam Dube','CSK',38,0,0,40,'M18_CSK_vs_DC'),
(18,'Ashutosh Sharma','DC',38,0,0,38,'M18_CSK_vs_DC'),
(18,'Auqib Nabi','DC',5,4,0,9,'M18_CSK_vs_DC'),
(18,'Axar Patel','DC',1,28,0,29,'M18_CSK_vs_DC'),
(18,'David Miller','DC',22,0,0,22,'M18_CSK_vs_DC'),
(18,'KL Rahul','DC',36,0,0,36,'M18_CSK_vs_DC'),
(18,'Kuldeep Yadav','DC',4,-8,0,-4,'M18_CSK_vs_DC'),
(18,'Lungi Ngidi','DC',3,4,0,7,'M18_CSK_vs_DC'),
(18,'Mukesh Kumar','DC',0,8,0,8,'M18_CSK_vs_DC'),
(18,'Pathum Nissanka','DC',60,0,10,70,'M18_CSK_vs_DC'),
(18,'Sameer Rizvi','DC',7,0,0,7,'M18_CSK_vs_DC'),
(18,'T Natarajan','DC',1,-6,0,-5,'M18_CSK_vs_DC'),
(18,'Tristan Stubbs','DC',84,0,0,84,'M18_CSK_vs_DC'),
(19,'Ashok Sharma','GT',0,68,0,70,'M19_LSG_vs_GT'),
(19,'Glenn Phillips','GT',0,0,20,22,'M19_LSG_vs_GT'),
(19,'Jos Buttler','GT',85,0,10,97,'M19_LSG_vs_GT'),
(19,'Kagiso Rabada','GT',0,26,0,28,'M19_LSG_vs_GT'),
(19,'M Shahrukh Khan','GT',0,0,10,12,'M19_LSG_vs_GT'),
(19,'Mohammed Siraj','GT',0,54,0,56,'M19_LSG_vs_GT'),
(19,'Prasidh Krishna','GT',0,118,0,135,'M19_LSG_vs_GT'),
(19,'Rahul Tewatia','GT',11,0,10,23,'M19_LSG_vs_GT'),
(19,'Rashid Khan','GT',0,16,0,18,'M19_LSG_vs_GT'),
(19,'Sai Sudharsan','GT',20,0,0,22,'M19_LSG_vs_GT'),
(19,'Shubman Gill','GT',74,0,20,96,'M19_LSG_vs_GT'),
(19,'Washington Sundar','GT',33,0,10,45,'M19_LSG_vs_GT'),
(19,'Abdul Samad','LSG',18,0,0,18,'M19_LSG_vs_GT'),
(19,'Aiden Markram','LSG',43,2,10,55,'M19_LSG_vs_GT'),
(19,'Avesh Khan','LSG',5,-4,10,11,'M19_LSG_vs_GT'),
(19,'Ayush Badoni','LSG',8,0,0,8,'M19_LSG_vs_GT'),
(19,'Digvesh Rathi','LSG',0,32,0,32,'M19_LSG_vs_GT'),
(19,'Mitchell Marsh','LSG',14,0,0,14,'M19_LSG_vs_GT'),
(19,'Mohammed Shami','LSG',15,42,0,57,'M19_LSG_vs_GT'),
(19,'Mukul Choudhary','LSG',25,0,0,25,'M19_LSG_vs_GT'),
(19,'Nicholas Pooran','LSG',23,0,0,23,'M19_LSG_vs_GT'),
(19,'Prince Yadav','LSG',0,38,0,38,'M19_LSG_vs_GT'),
(19,'Rishabh Pant','LSG',30,0,10,40,'M19_LSG_vs_GT'),
(19,'George Linde','LSG',27,6,0,33,'M19_LSG_vs_GT'),
(20,'Hardik Pandya','MI',64,32,10,106,'M20_MI_vs_RCB'),
(20,'Jasprit Bumrah','MI',0,8,0,8,'M20_MI_vs_RCB'),
(20,'Mayank Markande','MI',0,-12,0,-12,'M20_MI_vs_RCB'),
(20,'Mitchell Santner','MI',9,34,0,43,'M20_MI_vs_RCB'),
(20,'Naman Dhir','MI',1,0,0,1,'M20_MI_vs_RCB'),
(20,'Rohit Sharma','MI',27,0,0,27,'M20_MI_vs_RCB'),
(20,'Ryan Rickelton','MI',56,0,0,56,'M20_MI_vs_RCB'),
(20,'Shardul Thakur','MI',0,14,0,14,'M20_MI_vs_RCB'),
(20,'Sherfane Rutherford','MI',118,0,0,118,'M20_MI_vs_RCB'),
(20,'Suryakumar Yadav','MI',48,0,10,58,'M20_MI_vs_RCB'),
(20,'Tilak Varma','MI',1,0,10,11,'M20_MI_vs_RCB'),
(20,'Trent Boult','MI',0,32,0,32,'M20_MI_vs_RCB'),
(20,'Bhuvneshwar Kumar','RCB',0,6,10,18,'M20_MI_vs_RCB'),
(20,'Devdutt Padikkal','RCB',0,0,0,2,'M20_MI_vs_RCB'),
(20,'Jacob Duffy','RCB',0,28,10,40,'M20_MI_vs_RCB'),
(20,'Jitesh Sharma','RCB',11,0,0,13,'M20_MI_vs_RCB'),
(20,'Krunal Pandya','RCB',0,36,0,38,'M20_MI_vs_RCB'),
(20,'Phil Salt','RCB',122,0,0,139,'M20_MI_vs_RCB'),
(20,'Rajat Patidar','RCB',95,0,10,107,'M20_MI_vs_RCB'),
(20,'Rasikh Salam','RCB',0,34,10,46,'M20_MI_vs_RCB'),
(20,'Romario Shepherd','RCB',2,-8,10,6,'M20_MI_vs_RCB'),
(20,'Suyash Sharma','RCB',0,50,0,52,'M20_MI_vs_RCB'),
(20,'Tim David','RCB',58,0,0,60,'M20_MI_vs_RCB'),
(20,'Virat Kohli','RCB',67,0,0,69,'M20_MI_vs_RCB');

create temporary table vt_owner_scores(
  owner_name text,
  match_number integer,
  total numeric
) on commit drop;

insert into vt_owner_scores values
('Bala',11,229),
('Jeba',11,344),
('Johny',11,382),
('Mansur',11,430),
('Murali',11,904),
('Pandiyan',11,231),
('Saravana',11,319),
('Sashi',11,128),
('Tamil',11,515),
('Bala',13,108),
('Jeba',13,473),
('Johny',13,86),
('Mansur',13,86),
('Murali',13,130),
('Pandiyan',13,512),
('Saravana',13,371),
('Sashi',13,457),
('Tamil',13,611),
('Bala',14,436),
('Jeba',14,281),
('Johny',14,522),
('Mansur',14,482),
('Murali',14,245),
('Pandiyan',14,227),
('Saravana',14,117),
('Sashi',14,236),
('Tamil',14,454),
('Bala',15,292),
('Jeba',15,300),
('Johny',15,169),
('Mansur',15,256),
('Murali',15,79),
('Pandiyan',15,396),
('Saravana',15,150),
('Sashi',15,94),
('Tamil',15,231),
('Bala',16,234),
('Jeba',16,387),
('Johny',16,638),
('Mansur',16,490),
('Murali',16,520),
('Pandiyan',16,600),
('Saravana',16,450),
('Sashi',16,589),
('Tamil',16,849),
('Bala',17,268),
('Jeba',17,511),
('Johny',17,1589),
('Mansur',17,378),
('Murali',17,85),
('Pandiyan',17,544),
('Saravana',17,410),
('Sashi',17,506),
('Tamil',17,280),
('Bala',18,1675),
('Jeba',18,394),
('Johny',18,118),
('Mansur',18,376),
('Murali',18,783),
('Pandiyan',18,153),
('Saravana',18,472),
('Sashi',18,250),
('Tamil',18,396),
('Bala',19,300),
('Jeba',19,362),
('Johny',19,513),
('Mansur',19,383),
('Murali',19,342),
('Pandiyan',19,299),
('Saravana',19,341),
('Sashi',19,163),
('Tamil',19,194),
('Bala',20,142),
('Jeba',20,375),
('Johny',20,445),
('Mansur',20,408),
('Murali',20,281),
('Pandiyan',20,415),
('Saravana',20,417),
('Sashi',20,303),
('Tamil',20,667);

create temporary table vt_match_results(
  match_number integer primary key,
  result_text text not null,
  winner_team text,
  source_url text not null
) on commit drop;

insert into vt_match_results values
(11,'RCB won by 43 runs','RCB','https://www.espn.com/cricket/series/8048/scorecard/1527684/royal-challengers-bengaluru-vs-chennai-super-kings-11th-match-indian-premier-league-2026'),
(12,'No result',null,'https://www.espn.com/cricket/series/8048/report/1527685/kolkata-knight-riders-vs-punjab-kings-12th-match-indian-premier-league-2026'),
(13,'RR won by 27 runs','RR','https://www.espn.com/cricket/series/8048/scorecard/1527686/rajasthan-royals-vs-mumbai-indians-13th-match-indian-premier-league-2026'),
(14,'GT won by 1 run','GT','https://www.espn.com/cricket/series/8048/scorecard/1527687/delhi-capitals-vs-gujarat-titans-14th-match-indian-premier-league-2026'),
(15,'LSG won by 3 wickets','LSG','https://www.espn.com/cricket/series/8048/scorecard/1527688/kolkata-knight-riders-vs-lucknow-super-giants-15th-match-indian-premier-league-2026'),
(16,'RR won by 6 wickets','RR','https://www.espn.com/cricket/series/8048/scorecard/1527689/rajasthan-royals-vs-royal-challengers-bengaluru-16th-match-indian-premier-league-2026'),
(17,'PBKS won by 6 wickets','PBKS','https://www.espn.com/cricket/series/8048/scorecard/1527690/punjab-kings-vs-sunrisers-hyderabad-17th-match-indian-premier-league-2026'),
(18,'CSK won by 23 runs','CSK','https://www.espn.com/cricket/series/8048/scorecard/1527691/chennai-super-kings-vs-delhi-capitals-18th-match-indian-premier-league-2026'),
(19,'GT won by 7 wickets','GT','https://www.espn.com/cricket/series/8048/scorecard/1527692/lucknow-super-giants-vs-gujarat-titans-19th-match-indian-premier-league-2026'),
(20,'RCB won by 18 runs','RCB','https://www.espn.com/cricket/series/8048/scorecard/1527693/mumbai-indians-vs-royal-challengers-bengaluru-20th-match-indian-premier-league-2026');

do $$
begin
  if (select count(*) from vt_lineups) <> 90 then
    raise exception 'Expected 90 lineups';
  end if;
  if (select count(*) from vt_lineup_players) <> 990 then
    raise exception 'Expected 990 lineup players';
  end if;
  if (select count(*) from vt_points) <> 216 then
    raise exception 'Expected 216 player point rows from nine completed matches';
  end if;
  if (select count(*) from vt_owner_scores) <> 81 then
    raise exception 'Expected 81 owner scores; Match 12 must be excluded';
  end if;
  if exists (
    select 1 from vt_lineup_players
    group by owner_name, match_number
    having count(*) <> 11 or count(distinct (player_name, team_code)) <> 11
  ) then
    raise exception 'Every lineup must have 11 unique player/team rows';
  end if;
  if exists (
    select 1
    from vt_lineups lineup
    where not exists (
      select 1 from vt_lineup_players player
      where player.owner_name = lineup.owner_name
        and player.match_number = lineup.match_number
        and player.player_name = lineup.captain_name
        and player.marker = 'C'
    )
    or not exists (
      select 1 from vt_lineup_players player
      where player.owner_name = lineup.owner_name
        and player.match_number = lineup.match_number
        and player.player_name = lineup.vice_captain_name
        and player.marker = 'VC'
    )
  ) then
    raise exception 'A source lineup is missing its resolved captain or vice-captain';
  end if;
  if exists (
    select 1
    from vt_lineup_players source
    left join public.cricket_teams team on team.code = source.team_code
    left join public.players player
      on player.full_name = source.player_name
     and player.team_id = team.id
    where player.id is null
  ) then
    raise exception 'One or more lineup players did not resolve by name and IPL team';
  end if;
  if exists (
    select 1
    from vt_points source
    left join public.cricket_teams team on team.code = source.team_code
    left join public.players player
      on player.full_name = source.player_name
     and player.team_id = team.id
    where player.id is null
  ) then
    raise exception 'One or more point rows did not resolve by name and IPL team';
  end if;
  if (
    select count(*)
    from public.league_members
    where league_id = '2fa606e1-2299-4c6d-9acf-348b7b858a49'
      and status = 'active'
      and role in ('league_admin', 'owner')
  ) <> 9 then
    raise exception 'Expected 9 active league owners';
  end if;
  if (
    select count(*)
    from public.lineup_submissions lineup
    join public.fixtures fixture on fixture.id = lineup.fixture_id
    where lineup.league_id = '2fa606e1-2299-4c6d-9acf-348b7b858a49'
      and fixture.match_number between 1 and 10
  ) <> 90 then
    raise exception 'Matches 1-10 are not in the expected preserved state';
  end if;
end $$;

create table if not exists public.volume_test_match_backup (
  backup_id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  created_at timestamptz not null default now(),
  label text not null,
  payload jsonb not null
);
revoke all on public.volume_test_match_backup from anon, authenticated;

insert into public.volume_test_match_backup(league_id, label, payload)
select
  '2fa606e1-2299-4c6d-9acf-348b7b858a49',
  'pre-volume-test-m11-m20-' || to_char(clock_timestamp(), 'YYYYMMDD-HH24MISS'),
  jsonb_build_object(
    'fixtures', (
      select coalesce(jsonb_agg(to_jsonb(fixture) order by fixture.match_number), '[]'::jsonb)
      from public.fixtures fixture
      where fixture.league_id = '2fa606e1-2299-4c6d-9acf-348b7b858a49'
        and fixture.match_number between 11 and 21
    ),
    'lineup_submissions', (
      select coalesce(jsonb_agg(to_jsonb(lineup)), '[]'::jsonb)
      from public.lineup_submissions lineup
      join public.fixtures fixture on fixture.id = lineup.fixture_id
      where lineup.league_id = '2fa606e1-2299-4c6d-9acf-348b7b858a49'
        and fixture.match_number between 11 and 20
    ),
    'lineup_players', (
      select coalesce(jsonb_agg(to_jsonb(player)), '[]'::jsonb)
      from public.lineup_players player
      join public.lineup_submissions lineup on lineup.id = player.lineup_id
      join public.fixtures fixture on fixture.id = lineup.fixture_id
      where lineup.league_id = '2fa606e1-2299-4c6d-9acf-348b7b858a49'
        and fixture.match_number between 11 and 20
    ),
    'lineup_boosters', (
      select coalesce(jsonb_agg(to_jsonb(booster)), '[]'::jsonb)
      from public.lineup_boosters booster
      join public.fixtures fixture on fixture.id = booster.fixture_id
      where booster.league_id = '2fa606e1-2299-4c6d-9acf-348b7b858a49'
        and fixture.match_number between 11 and 20
    ),
    'transfer_events', (
      select coalesce(jsonb_agg(to_jsonb(event)), '[]'::jsonb)
      from public.transfer_events event
      join public.fixtures fixture on fixture.id = event.fixture_id
      where event.league_id = '2fa606e1-2299-4c6d-9acf-348b7b858a49'
        and fixture.match_number between 11 and 20
    ),
    'player_match_points', (
      select coalesce(jsonb_agg(to_jsonb(points)), '[]'::jsonb)
      from public.player_match_points points
      join public.fixtures fixture on fixture.id = points.fixture_id
      where fixture.league_id = '2fa606e1-2299-4c6d-9acf-348b7b858a49'
        and fixture.match_number between 11 and 20
    ),
    'member_match_scores', (
      select coalesce(jsonb_agg(to_jsonb(score)), '[]'::jsonb)
      from public.member_match_scores score
      join public.fixtures fixture on fixture.id = score.fixture_id
      where fixture.league_id = '2fa606e1-2299-4c6d-9acf-348b7b858a49'
        and fixture.match_number between 11 and 20
    ),
    'special_adjustments', (
      select coalesce(jsonb_agg(to_jsonb(adjustment)), '[]'::jsonb)
      from public.special_player_score_adjustments adjustment
      join public.fixtures fixture on fixture.id = adjustment.fixture_id
      where adjustment.league_id = '2fa606e1-2299-4c6d-9acf-348b7b858a49'
        and fixture.match_number between 11 and 20
    )
  );

delete from public.special_player_score_adjustments adjustment
using public.fixtures fixture
where adjustment.fixture_id = fixture.id
  and adjustment.league_id = '2fa606e1-2299-4c6d-9acf-348b7b858a49'
  and fixture.match_number between 11 and 20;

delete from public.member_match_scores score
using public.fixtures fixture
where score.fixture_id = fixture.id
  and fixture.league_id = '2fa606e1-2299-4c6d-9acf-348b7b858a49'
  and fixture.match_number between 11 and 20;

delete from public.player_match_points points
using public.fixtures fixture
where points.fixture_id = fixture.id
  and fixture.league_id = '2fa606e1-2299-4c6d-9acf-348b7b858a49'
  and fixture.match_number between 11 and 20;

delete from public.transfer_events event
using public.fixtures fixture
where event.fixture_id = fixture.id
  and event.league_id = '2fa606e1-2299-4c6d-9acf-348b7b858a49'
  and fixture.match_number between 11 and 20;

delete from public.lineup_boosters booster
using public.fixtures fixture
where booster.fixture_id = fixture.id
  and booster.league_id = '2fa606e1-2299-4c6d-9acf-348b7b858a49'
  and fixture.match_number between 11 and 20;

delete from public.lineup_submissions lineup
using public.fixtures fixture
where lineup.fixture_id = fixture.id
  and lineup.league_id = '2fa606e1-2299-4c6d-9acf-348b7b858a49'
  and fixture.match_number between 11 and 20;

update public.fixtures fixture
set status = case
      when fixture.match_number = 12 then 'cancelled'
      when fixture.match_number between 11 and 20 then 'completed'
      else 'scheduled'
    end,
    scoring_status = case
      when fixture.match_number between 11 and 20 and fixture.match_number <> 12 then 'published'
      else 'pending'
    end,
    scheduled_start = case fixture.match_number
      when 11 then '2026-08-13 00:00:00+00'::timestamptz
      when 12 then '2026-08-13 03:00:00+00'::timestamptz
      when 13 then '2026-08-13 06:00:00+00'::timestamptz
      when 14 then '2026-08-13 09:00:00+00'::timestamptz
      when 15 then '2026-08-13 12:00:00+00'::timestamptz
      when 16 then '2026-08-13 15:00:00+00'::timestamptz
      when 17 then '2026-08-13 18:00:00+00'::timestamptz
      when 18 then '2026-08-13 21:00:00+00'::timestamptz
      when 19 then '2026-08-14 00:00:00+00'::timestamptz
      when 20 then '2026-08-14 03:00:00+00'::timestamptz
      else '2026-08-16 14:00:00+00'::timestamptz
    end,
    lineup_lock_at = case fixture.match_number
      when 11 then '2026-08-13 00:00:00+00'::timestamptz
      when 12 then '2026-08-13 03:00:00+00'::timestamptz
      when 13 then '2026-08-13 06:00:00+00'::timestamptz
      when 14 then '2026-08-13 09:00:00+00'::timestamptz
      when 15 then '2026-08-13 12:00:00+00'::timestamptz
      when 16 then '2026-08-13 15:00:00+00'::timestamptz
      when 17 then '2026-08-13 18:00:00+00'::timestamptz
      when 18 then '2026-08-13 21:00:00+00'::timestamptz
      when 19 then '2026-08-14 00:00:00+00'::timestamptz
      when 20 then '2026-08-14 03:00:00+00'::timestamptz
      else '2026-08-16 14:00:00+00'::timestamptz
    end,
    scorecard_source_url = case
      when fixture.match_number between 11 and 20
        then (select result.source_url from vt_match_results result where result.match_number = fixture.match_number)
      else 'https://www.espn.com/cricket/scores/series/8048/ipl'
    end,
    updated_at = now()
where fixture.league_id = '2fa606e1-2299-4c6d-9acf-348b7b858a49'
  and fixture.match_number between 11 and 21;

alter table public.lineup_submissions
  disable trigger enforce_special_lineup_markers_before_write;

with resolved as (
  select
    source.*,
    member.id as member_id,
    fixture.id as fixture_id,
    captain.id as captain_id,
    vice.id as vice_id,
    impact.id as impact_id,
    (
      select sum(player.cost)
      from vt_lineup_players player
      where player.owner_name = source.owner_name
        and player.match_number = source.match_number
    ) as lineup_cost,
    (
      select count(*)
      from vt_lineup_players selected
      join public.cricket_teams team on team.code = selected.team_code
      join public.players player
        on player.full_name = selected.player_name
       and player.team_id = team.id
      join public.league_players league_player
        on league_player.league_id = member.league_id
       and league_player.player_id = player.id
      where selected.owner_name = source.owner_name
        and selected.match_number = source.match_number
        and league_player.owner_member_id is distinct from member.id
    ) as borrowed_count
  from vt_lineups source
  join public.league_members member
    on member.league_id = '2fa606e1-2299-4c6d-9acf-348b7b858a49'
   and member.display_name = source.owner_name
   and member.status = 'active'
  join public.fixtures fixture
    on fixture.league_id = member.league_id
   and fixture.match_number = source.match_number
  join lateral (
    select player.id
    from vt_lineup_players selected
    join public.cricket_teams team on team.code = selected.team_code
    join public.players player
      on player.full_name = selected.player_name
     and player.team_id = team.id
    where selected.owner_name = source.owner_name
      and selected.match_number = source.match_number
      and selected.player_name = source.captain_name
    limit 1
  ) captain on true
  join lateral (
    select player.id
    from vt_lineup_players selected
    join public.cricket_teams team on team.code = selected.team_code
    join public.players player
      on player.full_name = selected.player_name
     and player.team_id = team.id
    where selected.owner_name = source.owner_name
      and selected.match_number = source.match_number
      and selected.player_name = source.vice_captain_name
    limit 1
  ) vice on true
  left join lateral (
    select player.id
    from vt_lineup_players selected
    join public.cricket_teams team on team.code = selected.team_code
    join public.players player
      on player.full_name = selected.player_name
     and player.team_id = team.id
    where selected.owner_name = source.owner_name
      and selected.match_number = source.match_number
      and selected.player_name = source.impact_name
    limit 1
  ) impact on source.impact_name <> ''
)
insert into public.lineup_submissions(
  league_id, fixture_id, member_id, status,
  captain_player_id, vice_captain_player_id, impact_player_id, impact_type,
  lineup_cost, borrowed_player_count, submitted_at, locked_at,
  validation_status, validation_errors, validated_rule_set_id
)
select
  '2fa606e1-2299-4c6d-9acf-348b7b858a49',
  resolved.fixture_id,
  resolved.member_id,
  'locked',
  resolved.captain_id,
  resolved.vice_id,
  resolved.impact_id,
  nullif(resolved.impact_type, ''),
  resolved.lineup_cost,
  resolved.borrowed_count,
  fixture.lineup_lock_at - interval '1 hour',
  fixture.lineup_lock_at,
  'valid',
  '[]'::jsonb,
  (
    select rules.id
    from public.lineup_rule_sets rules
    where rules.league_id = '2fa606e1-2299-4c6d-9acf-348b7b858a49'
      and rules.active
    limit 1
  )
from resolved
join public.fixtures fixture on fixture.id = resolved.fixture_id;

alter table public.lineup_submissions
  enable trigger enforce_special_lineup_markers_before_write;

insert into public.lineup_players(lineup_id, player_id, slot, is_borrowed)
select
  lineup.id,
  player.id,
  source.slot,
  league_player.owner_member_id is distinct from lineup.member_id
from vt_lineup_players source
join public.league_members member
  on member.league_id = '2fa606e1-2299-4c6d-9acf-348b7b858a49'
 and member.display_name = source.owner_name
 and member.status = 'active'
join public.fixtures fixture
  on fixture.league_id = member.league_id
 and fixture.match_number = source.match_number
join public.lineup_submissions lineup
  on lineup.fixture_id = fixture.id
 and lineup.member_id = member.id
join public.cricket_teams team on team.code = source.team_code
join public.players player
  on player.full_name = source.player_name
 and player.team_id = team.id
join public.league_players league_player
  on league_player.league_id = member.league_id
 and league_player.player_id = player.id;

-- Charge incoming borrowed players. Match 11 compares against the existing
-- Match 10 XI; later matches initially compare against their immediate source
-- XI. The No Result settlement then authoritatively refunds Match 12 and
-- rebases Match 13 against Match 11.
insert into public.transfer_events(
  league_id, member_id, fixture_id, player_in_id, stage, transfer_period_id,
  transfer_count, reason, created_by, created_at
)
select
  member.league_id,
  member.id,
  fixture.id,
  player.id,
  case when fixture.match_number > 70 then 'playoff' else 'league' end,
  period.id,
  1,
  'lineup_change',
  auth.uid(),
  fixture.lineup_lock_at - interval '1 hour'
from vt_lineup_players current_row
join public.league_members member
  on member.league_id = '2fa606e1-2299-4c6d-9acf-348b7b858a49'
 and member.display_name = current_row.owner_name
 and member.status = 'active'
join public.fixtures fixture
  on fixture.league_id = member.league_id
 and fixture.match_number = current_row.match_number
join public.cricket_teams team on team.code = current_row.team_code
join public.players player
  on player.full_name = current_row.player_name
 and player.team_id = team.id
join public.league_players league_player
  on league_player.league_id = member.league_id
 and league_player.player_id = player.id
left join public.league_transfer_periods period
  on period.league_id = member.league_id
 and period.active
 and fixture.match_number between period.start_match_number and period.end_match_number
where league_player.owner_member_id is distinct from member.id
  and not exists (
    select 1
    from vt_lineup_players prior
    where current_row.match_number > 11
      and prior.owner_name = current_row.owner_name
      and prior.match_number = current_row.match_number - 1
      and prior.player_name = current_row.player_name
      and prior.team_code = current_row.team_code
    union all
    select 1
    from public.lineup_submissions prior_lineup
    join public.fixtures prior_fixture on prior_fixture.id = prior_lineup.fixture_id
    join public.lineup_players prior_player on prior_player.lineup_id = prior_lineup.id
    where current_row.match_number = 11
      and prior_lineup.league_id = member.league_id
      and prior_lineup.member_id = member.id
      and prior_fixture.match_number = 10
      and prior_player.player_id = player.id
  );

insert into public.lineup_boosters(
  league_id, lineup_id, fixture_id, member_id, booster_rule_id, target_player_id
)
select
  lineup.league_id,
  lineup.id,
  lineup.fixture_id,
  lineup.member_id,
  booster.id,
  null
from vt_lineups source
join public.league_members member
  on member.league_id = '2fa606e1-2299-4c6d-9acf-348b7b858a49'
 and member.display_name = source.owner_name
 and member.status = 'active'
join public.fixtures fixture
  on fixture.league_id = member.league_id
 and fixture.match_number = source.match_number
join public.lineup_submissions lineup
  on lineup.fixture_id = fixture.id
 and lineup.member_id = member.id
join public.booster_rules booster
  on booster.league_id = member.league_id
 and booster.code = source.booster_code
where source.booster_code = '2UP';

insert into public.player_match_points(
  fixture_id, player_id, rule_set_id, raw_stats, breakdown,
  batting_points, bowling_points, fielding_points, bonus_points,
  calculation_version, calculated_at, published_at
)
select
  fixture.id,
  player.id,
  rules.id,
  jsonb_build_object(
    'source', 'google_league_score_template',
    'source_tab', source.source_tab,
    'scorecard_url', result.source_url,
    'player_name', source.player_name,
    'winner_team', result.winner_team,
    'match_result', result.result_text,
    'summary', 'Fantasy calculation imported from League workbook and cricket result cross-checked with ESPNcricinfo'
  ),
  jsonb_build_object(
    'batting', source.batting,
    'bowling', source.bowling,
    'fielding', source.fielding,
    'bonus', source.total - source.batting - source.bowling - source.fielding,
    'detail', 'League scoring-engine component breakdown'
  ),
  source.batting,
  source.bowling,
  source.fielding,
  source.total - source.batting - source.bowling - source.fielding,
  1,
  now(),
  now()
from vt_points source
join public.fixtures fixture
  on fixture.league_id = '2fa606e1-2299-4c6d-9acf-348b7b858a49'
 and fixture.match_number = source.match_number
join vt_match_results result on result.match_number = source.match_number
join public.cricket_teams team on team.code = source.team_code
join public.players player
  on player.full_name = source.player_name
 and player.team_id = team.id
cross join lateral (
  select scoring.id
  from public.scoring_rule_sets scoring
  where scoring.league_id = '2fa606e1-2299-4c6d-9acf-348b7b858a49'
    and scoring.active
  limit 1
) rules;

-- Rebuild the per-player ROY ledger for Matches 11-20 only. Existing royalty
-- history for Matches 1-10 remains untouched.
with royalty_values as (
  select
    lineup.league_id,
    lineup.fixture_id,
    special.id as rule_set_id,
    selected.player_id,
    lineup.member_id as source_member_id,
    league_player.owner_member_id as recipient_member_id,
    exists (
      select 1
      from public.effective_phase_special_players(fixture.phase_id, 'marquee') marquee
      where marquee.member_id = league_player.owner_member_id
        and marquee.player_id = selected.player_id
    ) as is_marquee,
    (
      case
        when lineup.impact_player_id = selected.player_id and lineup.impact_type = 'BAI'
          then points.batting_points * rules.impact_multiplier
        when lineup.impact_player_id = selected.player_id and lineup.impact_type = 'BOI'
          then points.bowling_points * rules.impact_multiplier
        else points.total_points
      end
      * case
          when lineup.captain_player_id = selected.player_id then rules.captain_multiplier
          when lineup.vice_captain_player_id = selected.player_id then rules.vice_captain_multiplier
          else 1
        end
      * case
          when booster.code = '3X' and lineup_booster.target_player_id = selected.player_id
            then booster.player_multiplier
          else 1
        end
      * case
          when booster.code = '2UP' then coalesce(booster.match_multiplier, 2)
          else 1
        end
    )::numeric as final_contribution,
    special.regular_royalty_percent,
    special.marquee_royalty_percent,
    special.regular_minimum_royalty,
    special.marquee_minimum_royalty,
    special.royalty_zero_floor,
    special.royalty_rounding
  from public.lineup_submissions lineup
  join public.fixtures fixture on fixture.id = lineup.fixture_id
  join public.lineup_players selected on selected.lineup_id = lineup.id
  join public.player_match_points points
    on points.fixture_id = lineup.fixture_id
   and points.player_id = selected.player_id
   and points.calculation_version = (
     select max(latest.calculation_version)
     from public.player_match_points latest
     where latest.fixture_id = lineup.fixture_id
   )
  join public.league_players league_player
    on league_player.league_id = lineup.league_id
   and league_player.player_id = selected.player_id
  join public.lineup_rule_sets rules
    on rules.id = public.lineup_rule_set_for_fixture(lineup.fixture_id)
  join lateral public.special_player_rules_for_match(
    lineup.league_id, fixture.match_number
  ) special on true
  left join public.lineup_boosters lineup_booster
    on lineup_booster.lineup_id = lineup.id
  left join public.booster_rules booster
    on booster.id = lineup_booster.booster_rule_id
  where lineup.league_id = '2fa606e1-2299-4c6d-9acf-348b7b858a49'
    and fixture.match_number between 11 and 20
    and fixture.match_number <> 12
    and lineup.status in ('submitted', 'locked')
    and league_player.owner_member_id is not null
    and league_player.owner_member_id <> lineup.member_id
    and coalesce(special.marquee_mode_enabled, false)
    and exists (
      select 1
      from public.lineup_submissions owner_lineup
      join public.lineup_players owner_player
        on owner_player.lineup_id = owner_lineup.id
      where owner_lineup.fixture_id = lineup.fixture_id
        and owner_lineup.member_id = league_player.owner_member_id
        and owner_lineup.status in ('submitted', 'locked')
        and owner_player.player_id = selected.player_id
    )
)
insert into public.special_player_score_adjustments(
  league_id, fixture_id, rule_set_id, player_id,
  source_member_id, recipient_member_id, adjustment_type,
  final_player_contribution, rate_percent, minimum_fee,
  adjustment_points, calculation_breakdown
)
select
  league_id,
  fixture_id,
  rule_set_id,
  player_id,
  source_member_id,
  recipient_member_id,
  case when is_marquee then 'marquee_royalty' else 'regular_royalty' end,
  final_contribution,
  case when is_marquee then marquee_royalty_percent else regular_royalty_percent end,
  case when is_marquee then marquee_minimum_royalty else regular_minimum_royalty end,
  public.special_royalty_points(
    final_contribution,
    case when is_marquee then marquee_royalty_percent else regular_royalty_percent end,
    case when is_marquee then marquee_minimum_royalty else regular_minimum_royalty end,
    royalty_zero_floor,
    royalty_rounding
  ),
  jsonb_build_object(
    'zero_floor', royalty_zero_floor,
    'rounding', royalty_rounding,
    'is_marquee', is_marquee,
    'owner_selected_player', true,
    'source', 'volume_test_m11_m20_backfill'
  )
from royalty_values;

insert into public.member_match_scores(
  fixture_id, member_id, lineup_id,
  base_points, captain_bonus, vice_captain_bonus,
  impact_adjustment, ownership_adjustment,
  rank, published_at, calculation_breakdown, special_rule_set_id
)
select
  fixture.id,
  member.id,
  lineup.id,
  source.total,
  0,
  0,
  0,
  0,
  dense_rank() over (partition by fixture.id order by source.total desc),
  now(),
  jsonb_build_object(
    'source', 'Google Sheet League tab',
    'sheet_total', source.total,
    'note', 'Historical total includes role multipliers, owner royalty and sheet booster calculation'
  ),
  (
    select special.id
    from public.special_player_rule_sets special
    where special.league_id = '2fa606e1-2299-4c6d-9acf-348b7b858a49'
      and special.active
    order by special.version desc
    limit 1
  )
from vt_owner_scores source
join public.league_members member
  on member.league_id = '2fa606e1-2299-4c6d-9acf-348b7b858a49'
 and member.display_name = source.owner_name
 and member.status = 'active'
join public.fixtures fixture
  on fixture.league_id = member.league_id
 and fixture.match_number = source.match_number
join public.lineup_submissions lineup
  on lineup.fixture_id = fixture.id
 and lineup.member_id = member.id;

-- Settle the washed-out fixture through the production rule path. This inserts
-- zero scores with no rank, cancels the Match 12 XIs, refunds usage, and
-- recalculates the first surviving locked XI (Match 13) against Match 11.
do $$
declare
  v_fixture_id uuid;
  v_result jsonb;
begin
  select fixture.id into v_fixture_id
  from public.fixtures fixture
  where fixture.league_id = '2fa606e1-2299-4c6d-9acf-348b7b858a49'
    and fixture.match_number = 12;

  select public.settle_no_result_match(v_fixture_id) into v_result;

  if coalesce((v_result ->> 'already_settled')::boolean, false) then
    raise exception 'Match 12 settlement unexpectedly reported already_settled';
  end if;
  if coalesce((v_result ->> 'member_count')::integer, 0) <> 9 then
    raise exception 'Match 12 settlement did not produce nine zero-point owner rows: %', v_result;
  end if;
  if coalesce((v_result ->> 'locked_lineups_recalculated')::integer, 0) <> 9 then
    raise exception 'Match 13 was not rebased for all nine owners: %', v_result;
  end if;
end $$;

insert into public.audit_events(
  league_id, actor_user_id, action, entity_type, entity_id, after_data
)
values(
  '2fa606e1-2299-4c6d-9acf-348b7b858a49',
  auth.uid(),
  'volume_test_matches_11_20_loaded',
  'league',
  '2fa606e1-2299-4c6d-9acf-348b7b858a49',
  jsonb_build_object(
    'lineups', 90,
    'lineup_players', 990,
    'scored_matches', 9,
    'no_result_match', 12,
    'next_match', 21,
    'next_start_utc', '2026-08-16 14:00:00+00',
    'next_start_ist', '2026-08-16 19:30',
    'source_sheet', '1N7KS_j4BFWP-C95TB9DgR0x251OnyKedzZtjQ6XH72w',
    'scorecard_provider', 'ESPNcricinfo / ESPN'
  )
);

do $$
begin
  if (
    select count(*)
    from public.lineup_submissions lineup
    join public.fixtures fixture on fixture.id = lineup.fixture_id
    where lineup.league_id = '2fa606e1-2299-4c6d-9acf-348b7b858a49'
      and fixture.match_number between 11 and 20
  ) <> 90 then
    raise exception 'Matches 11-20 lineup count mismatch';
  end if;

  if (
    select count(*)
    from public.lineup_submissions lineup
    join public.fixtures fixture on fixture.id = lineup.fixture_id
    where lineup.league_id = '2fa606e1-2299-4c6d-9acf-348b7b858a49'
      and fixture.match_number between 11 and 20
      and lineup.status = 'locked'
  ) <> 81 then
    raise exception 'Expected 81 surviving locked lineups';
  end if;

  if (
    select count(*)
    from public.lineup_submissions lineup
    join public.fixtures fixture on fixture.id = lineup.fixture_id
    where lineup.league_id = '2fa606e1-2299-4c6d-9acf-348b7b858a49'
      and fixture.match_number = 12
      and lineup.status = 'cancelled'
  ) <> 9 then
    raise exception 'Expected nine cancelled Match 12 lineups';
  end if;

  if (
    select count(*)
    from public.lineup_players player
    join public.lineup_submissions lineup on lineup.id = player.lineup_id
    join public.fixtures fixture on fixture.id = lineup.fixture_id
    where lineup.league_id = '2fa606e1-2299-4c6d-9acf-348b7b858a49'
      and fixture.match_number between 11 and 20
  ) <> 990 then
    raise exception 'Matches 11-20 lineup player count mismatch';
  end if;

  if (
    select count(*)
    from public.player_match_points points
    join public.fixtures fixture on fixture.id = points.fixture_id
    where fixture.league_id = '2fa606e1-2299-4c6d-9acf-348b7b858a49'
      and fixture.match_number between 11 and 20
      and points.published_at is not null
  ) <> 216 then
    raise exception 'Matches 11-20 published player-point count mismatch';
  end if;

  if (
    select count(*)
    from public.member_match_scores score
    join public.fixtures fixture on fixture.id = score.fixture_id
    where fixture.league_id = '2fa606e1-2299-4c6d-9acf-348b7b858a49'
      and fixture.match_number between 11 and 20
  ) <> 90 then
    raise exception 'Matches 11-20 owner-score count mismatch';
  end if;

  if (
    select count(*)
    from public.member_match_scores score
    join public.fixtures fixture on fixture.id = score.fixture_id
    where fixture.league_id = '2fa606e1-2299-4c6d-9acf-348b7b858a49'
      and fixture.match_number = 12
      and score.total_points = 0
      and score.rank is null
      and score.calculation_breakdown ->> 'no_result' = 'true'
  ) <> 9 then
    raise exception 'Match 12 No Result score rows are incorrect';
  end if;

  if (
    select count(*)
    from public.fixtures fixture
    where fixture.league_id = '2fa606e1-2299-4c6d-9acf-348b7b858a49'
      and fixture.match_number between 11 and 20
      and fixture.scoring_status = 'published'
  ) <> 10 then
    raise exception 'Matches 11-20 are not all published';
  end if;

  if not exists (
    select 1
    from public.fixtures fixture
    where fixture.league_id = '2fa606e1-2299-4c6d-9acf-348b7b858a49'
      and fixture.match_number = 21
      and fixture.status = 'scheduled'
      and fixture.scoring_status = 'pending'
      and fixture.scheduled_start = '2026-08-16 14:00:00+00'::timestamptz
      and fixture.lineup_lock_at = '2026-08-16 14:00:00+00'::timestamptz
  ) then
    raise exception 'Match 21 is not the Aug 16 next scheduled fixture';
  end if;
end $$;

select
  'ready' as status,
  (
    select count(*)
    from public.lineup_submissions lineup
    join public.fixtures fixture on fixture.id = lineup.fixture_id
    where lineup.league_id = '2fa606e1-2299-4c6d-9acf-348b7b858a49'
      and fixture.match_number between 11 and 20
  ) as imported_lineups,
  (
    select count(*)
    from public.player_match_points points
    join public.fixtures fixture on fixture.id = points.fixture_id
    where fixture.league_id = '2fa606e1-2299-4c6d-9acf-348b7b858a49'
      and fixture.match_number between 11 and 20
      and points.published_at is not null
  ) as published_player_points,
  (
    select count(*)
    from public.member_match_scores score
    join public.fixtures fixture on fixture.id = score.fixture_id
    where fixture.league_id = '2fa606e1-2299-4c6d-9acf-348b7b858a49'
      and fixture.match_number between 11 and 20
  ) as owner_scores,
  (
    select fixture.match_number
    from public.fixtures fixture
    where fixture.league_id = '2fa606e1-2299-4c6d-9acf-348b7b858a49'
      and fixture.status = 'scheduled'
      and fixture.scoring_status = 'pending'
    order by fixture.match_number
    limit 1
  ) as next_match,
  (
    select to_char(
      fixture.scheduled_start at time zone 'Asia/Kolkata',
      'YYYY-MM-DD HH24:MI'
    )
    from public.fixtures fixture
    where fixture.league_id = '2fa606e1-2299-4c6d-9acf-348b7b858a49'
      and fixture.match_number = 21
  ) as next_start_ist;

commit;
