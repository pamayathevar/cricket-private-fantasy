export type Role = "BA" | "BO" | "WK" | "AL";
export type Player = { name: string; team: string; role: Role; price: number; owner: string; bidPrice?: number | null };

// Snapshot imported read-only from the Google Sheet Squad tab.
export const squadPlayers: Player[] = [
  {
    "name": "Akash Madhwal",
    "team": "CSK",
    "role": "BO",
    "price": 7,
    "owner": "Bala"
  },
  {
    "name": "Akeal Hosein",
    "team": "CSK",
    "role": "BO",
    "price": 8,
    "owner": "Johny"
  },
  {
    "name": "Aman Khan",
    "team": "CSK",
    "role": "AL",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "Anshul Kamboj",
    "team": "CSK",
    "role": "AL",
    "price": 7,
    "owner": "Bala"
  },
  {
    "name": "Ayush Mhatre",
    "team": "CSK",
    "role": "BA",
    "price": 7,
    "owner": "Bala"
  },
  {
    "name": "Dewald Brevis",
    "team": "CSK",
    "role": "BA",
    "price": 8,
    "owner": "Sashi"
  },
  {
    "name": "Dian Forrester",
    "team": "CSK",
    "role": "AL",
    "price": 7,
    "owner": "Jeba"
  },
  {
    "name": "Gurjapneet Singh",
    "team": "CSK",
    "role": "BO",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "Jamie Overton",
    "team": "CSK",
    "role": "AL",
    "price": 8,
    "owner": "Jeba"
  },
  {
    "name": "Kartik Sharma",
    "team": "CSK",
    "role": "WK",
    "price": 7,
    "owner": "Pandiyan"
  },
  {
    "name": "Khaleel Ahmed",
    "team": "CSK",
    "role": "BO",
    "price": 8,
    "owner": "Pandiyan"
  },
  {
    "name": "Kuldip Yadav",
    "team": "CSK",
    "role": "BO",
    "price": 7,
    "owner": "Pandiyan"
  },
  {
    "name": "Macneil Noronha",
    "team": "CSK",
    "role": "AL",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "Matt Henry",
    "team": "CSK",
    "role": "BO",
    "price": 8,
    "owner": "Tamil"
  },
  {
    "name": "Matthew Short",
    "team": "CSK",
    "role": "BA",
    "price": 8,
    "owner": "Available"
  },
  {
    "name": "MS Dhoni",
    "team": "CSK",
    "role": "WK",
    "price": 8,
    "owner": "Mansur"
  },
  {
    "name": "Mukesh Choudhary",
    "team": "CSK",
    "role": "BO",
    "price": 7.5,
    "owner": "Available"
  },
  {
    "name": "Nathan Ellis",
    "team": "CSK",
    "role": "BO",
    "price": 8,
    "owner": "Jeba"
  },
  {
    "name": "Noor Ahmad",
    "team": "CSK",
    "role": "BO",
    "price": 8,
    "owner": "Saravana"
  },
  {
    "name": "Prashant Veer",
    "team": "CSK",
    "role": "AL",
    "price": 7,
    "owner": "Pandiyan"
  },
  {
    "name": "Rahul Chahar",
    "team": "CSK",
    "role": "BO",
    "price": 8,
    "owner": "Mansur"
  },
  {
    "name": "Ramakrishna Ghosh",
    "team": "CSK",
    "role": "AL",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "Ruturaj Gaikwad",
    "team": "CSK",
    "role": "BA",
    "price": 9,
    "owner": "Jeba"
  },
  {
    "name": "Sanju Samson",
    "team": "CSK",
    "role": "WK",
    "price": 8.5,
    "owner": "Murali"
  },
  {
    "name": "Sarfaraz Khan",
    "team": "CSK",
    "role": "BA",
    "price": 7,
    "owner": "Tamil"
  },
  {
    "name": "Shivam Dube",
    "team": "CSK",
    "role": "AL",
    "price": 8.5,
    "owner": "Bala"
  },
  {
    "name": "Shreyas Gopal",
    "team": "CSK",
    "role": "AL",
    "price": 8,
    "owner": "Available"
  },
  {
    "name": "Spencer Johnson",
    "team": "CSK",
    "role": "BO",
    "price": 7,
    "owner": "Jeba"
  },
  {
    "name": "Urvil Patel",
    "team": "CSK",
    "role": "WK",
    "price": 7,
    "owner": "Sashi"
  },
  {
    "name": "Zak Foulkes",
    "team": "CSK",
    "role": "AL",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "Abishek Porel",
    "team": "DC",
    "role": "WK",
    "price": 7,
    "owner": "Sashi"
  },
  {
    "name": "Ajay Mandal",
    "team": "DC",
    "role": "AL",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "Ashutosh Sharma",
    "team": "DC",
    "role": "AL",
    "price": 7.5,
    "owner": "Sashi"
  },
  {
    "name": "Auqib Nabi",
    "team": "DC",
    "role": "BO",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "Axar Patel",
    "team": "DC",
    "role": "AL",
    "price": 8.5,
    "owner": "Sashi"
  },
  {
    "name": "Ben Duckett",
    "team": "DC",
    "role": "BA",
    "price": 7.5,
    "owner": "Mansur"
  },
  {
    "name": "David Miller",
    "team": "DC",
    "role": "BA",
    "price": 9,
    "owner": "Bala"
  },
  {
    "name": "Dushmantha Chameera",
    "team": "DC",
    "role": "BO",
    "price": 8,
    "owner": "Jeba"
  },
  {
    "name": "Karun Nair",
    "team": "DC",
    "role": "BA",
    "price": 8,
    "owner": "Johny"
  },
  {
    "name": "KL Rahul",
    "team": "DC",
    "role": "WK",
    "price": 9,
    "owner": "Tamil"
  },
  {
    "name": "Kuldeep Yadav",
    "team": "DC",
    "role": "BO",
    "price": 8.5,
    "owner": "Murali"
  },
  {
    "name": "Kyle Jamieson",
    "team": "DC",
    "role": "BO",
    "price": 8,
    "owner": "Mansur"
  },
  {
    "name": "Lungi Ngidi",
    "team": "DC",
    "role": "BO",
    "price": 8,
    "owner": "Pandiyan"
  },
  {
    "name": "Madhav Tiwari",
    "team": "DC",
    "role": "AL",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "Mitchell Starc",
    "team": "DC",
    "role": "BO",
    "price": 8.5,
    "owner": "Saravana"
  },
  {
    "name": "Mukesh Kumar",
    "team": "DC",
    "role": "BO",
    "price": 8,
    "owner": "Bala"
  },
  {
    "name": "Nitish Rana",
    "team": "DC",
    "role": "BA",
    "price": 8,
    "owner": "Pandiyan"
  },
  {
    "name": "Pathum Nissanka",
    "team": "DC",
    "role": "BA",
    "price": 8,
    "owner": "Bala"
  },
  {
    "name": "Prithvi Shaw",
    "team": "DC",
    "role": "BA",
    "price": 7.5,
    "owner": "Tamil"
  },
  {
    "name": "Sahil Parakh",
    "team": "DC",
    "role": "BA",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "Sameer Rizvi",
    "team": "DC",
    "role": "BA",
    "price": 7,
    "owner": "Murali"
  },
  {
    "name": "T Natarajan",
    "team": "DC",
    "role": "BO",
    "price": 8,
    "owner": "Jeba"
  },
  {
    "name": "Tripurana Vijay",
    "team": "DC",
    "role": "BO",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "Tristan Stubbs",
    "team": "DC",
    "role": "BA",
    "price": 8,
    "owner": "Jeba"
  },
  {
    "name": "Vipraj Nigam",
    "team": "DC",
    "role": "BO",
    "price": 7.5,
    "owner": "Pandiyan"
  },
  {
    "name": "Anuj Rawat",
    "team": "GT",
    "role": "WK",
    "price": 8,
    "owner": "Available"
  },
  {
    "name": "Arshad Khan",
    "team": "GT",
    "role": "BO",
    "price": 7,
    "owner": "Bala"
  },
  {
    "name": "Ashok Sharma",
    "team": "GT",
    "role": "BO",
    "price": 7,
    "owner": "Jeba"
  },
  {
    "name": "Connor Esterhuizen",
    "team": "GT",
    "role": "BA",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "Glenn Phillips",
    "team": "GT",
    "role": "AL",
    "price": 8,
    "owner": "Murali"
  },
  {
    "name": "Gurnoor Brar",
    "team": "GT",
    "role": "BO",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "Ishant Sharma",
    "team": "GT",
    "role": "BO",
    "price": 8,
    "owner": "Sashi"
  },
  {
    "name": "Jason Holder",
    "team": "GT",
    "role": "AL",
    "price": 8.5,
    "owner": "Saravana"
  },
  {
    "name": "Jayant Yadav",
    "team": "GT",
    "role": "BO",
    "price": 8,
    "owner": "Tamil"
  },
  {
    "name": "Jos Buttler",
    "team": "GT",
    "role": "WK",
    "price": 9.5,
    "owner": "Johny"
  },
  {
    "name": "Kagiso Rabada",
    "team": "GT",
    "role": "BO",
    "price": 8.5,
    "owner": "Sashi"
  },
  {
    "name": "Kulwant Khejroliya",
    "team": "GT",
    "role": "BO",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "Kumar Kushagra",
    "team": "GT",
    "role": "WK",
    "price": 7,
    "owner": "Pandiyan"
  },
  {
    "name": "Luke Wood",
    "team": "GT",
    "role": "BO",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "M Shahrukh Khan",
    "team": "GT",
    "role": "BA",
    "price": 8,
    "owner": "Pandiyan"
  },
  {
    "name": "Manav Suthar",
    "team": "GT",
    "role": "AL",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "Mohammed Siraj",
    "team": "GT",
    "role": "BO",
    "price": 8.5,
    "owner": "Mansur"
  },
  {
    "name": "Nishant Sindhu",
    "team": "GT",
    "role": "AL",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "Prasidh Krishna",
    "team": "GT",
    "role": "BO",
    "price": 8,
    "owner": "Murali"
  },
  {
    "name": "Prithvi Raj",
    "team": "GT",
    "role": "BO",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "Rahul Tewatia",
    "team": "GT",
    "role": "AL",
    "price": 8,
    "owner": "Bala"
  },
  {
    "name": "Rashid Khan",
    "team": "GT",
    "role": "AL",
    "price": 9.5,
    "owner": "Sashi"
  },
  {
    "name": "Sai Kishore",
    "team": "GT",
    "role": "BO",
    "price": 8,
    "owner": "Jeba"
  },
  {
    "name": "Sai Sudharsan",
    "team": "GT",
    "role": "BA",
    "price": 8,
    "owner": "Saravana"
  },
  {
    "name": "Shubman Gill",
    "team": "GT",
    "role": "BA",
    "price": 9,
    "owner": "Mansur"
  },
  {
    "name": "Tom Banton",
    "team": "GT",
    "role": "WK",
    "price": 7.5,
    "owner": "Available"
  },
  {
    "name": "Washington Sundar",
    "team": "GT",
    "role": "AL",
    "price": 8,
    "owner": "Pandiyan"
  },
  {
    "name": "Ajinkya Rahane",
    "team": "KKR",
    "role": "BA",
    "price": 8.5,
    "owner": "Saravana"
  },
  {
    "name": "Akash Deep",
    "team": "KKR",
    "role": "BO",
    "price": 7.5,
    "owner": "Bala"
  },
  {
    "name": "Angkrish Raghuvanshi",
    "team": "KKR",
    "role": "BA",
    "price": 7.5,
    "owner": "Pandiyan"
  },
  {
    "name": "Anukul Roy",
    "team": "KKR",
    "role": "AL",
    "price": 7.5,
    "owner": "Available"
  },
  {
    "name": "Blessing Muzarabani",
    "team": "KKR",
    "role": "BO",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "Cameron Green",
    "team": "KKR",
    "role": "AL",
    "price": 8.5,
    "owner": "Mansur"
  },
  {
    "name": "Daksh Kamra",
    "team": "KKR",
    "role": "AL",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "Finn Allen",
    "team": "KKR",
    "role": "BA",
    "price": 8,
    "owner": "Available"
  },
  {
    "name": "Harshit Rana",
    "team": "KKR",
    "role": "BO",
    "price": 8,
    "owner": "Saravana"
  },
  {
    "name": "Kartik Tyagi",
    "team": "KKR",
    "role": "BO",
    "price": 7,
    "owner": "Jeba"
  },
  {
    "name": "Manish Pandey",
    "team": "KKR",
    "role": "BA",
    "price": 8,
    "owner": "Available"
  },
  {
    "name": "Matheesha Pathirana",
    "team": "KKR",
    "role": "BO",
    "price": 8,
    "owner": "Sashi"
  },
  {
    "name": "Mustafizur Rahman",
    "team": "KKR",
    "role": "BO",
    "price": 9,
    "owner": "Available"
  },
  {
    "name": "Navdeep Saini",
    "team": "KKR",
    "role": "BO",
    "price": 7.5,
    "owner": "Saravana"
  },
  {
    "name": "Prashant Solanki",
    "team": "KKR",
    "role": "BO",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "Rachin Ravindra",
    "team": "KKR",
    "role": "AL",
    "price": 8.5,
    "owner": "Johny"
  },
  {
    "name": "Rahul Tripathi",
    "team": "KKR",
    "role": "BA",
    "price": 8,
    "owner": "Available"
  },
  {
    "name": "Ramandeep Singh",
    "team": "KKR",
    "role": "BA",
    "price": 7.5,
    "owner": "Sashi"
  },
  {
    "name": "Rinku Singh",
    "team": "KKR",
    "role": "BA",
    "price": 8.5,
    "owner": "Murali"
  },
  {
    "name": "Rovman Powell",
    "team": "KKR",
    "role": "BA",
    "price": 8.5,
    "owner": "Mansur"
  },
  {
    "name": "Sarthak Ranjan",
    "team": "KKR",
    "role": "BA",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "Saurabh Dubey",
    "team": "KKR",
    "role": "BO",
    "price": 7,
    "owner": "Bala"
  },
  {
    "name": "Sunil Narine",
    "team": "KKR",
    "role": "AL",
    "price": 8.5,
    "owner": "Jeba"
  },
  {
    "name": "Tejasvi Dahiya",
    "team": "KKR",
    "role": "WK",
    "price": 7,
    "owner": "Jeba"
  },
  {
    "name": "Tim Seifert",
    "team": "KKR",
    "role": "WK",
    "price": 8,
    "owner": "Tamil"
  },
  {
    "name": "Umran Malik",
    "team": "KKR",
    "role": "BO",
    "price": 8,
    "owner": "Tamil"
  },
  {
    "name": "Vaibhav Arora",
    "team": "KKR",
    "role": "BO",
    "price": 7.5,
    "owner": "Bala"
  },
  {
    "name": "Varun Chakravarthy",
    "team": "KKR",
    "role": "BO",
    "price": 8,
    "owner": "Pandiyan"
  },
  {
    "name": "Abdul Samad",
    "team": "LSG",
    "role": "BA",
    "price": 7.5,
    "owner": "Sashi"
  },
  {
    "name": "Aiden Markram",
    "team": "LSG",
    "role": "BA",
    "price": 9,
    "owner": "Jeba"
  },
  {
    "name": "Akash Singh",
    "team": "LSG",
    "role": "BO",
    "price": 7,
    "owner": "Bala"
  },
  {
    "name": "Akshat Raghuwanshi",
    "team": "LSG",
    "role": "BA",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "Anrich Nortje",
    "team": "LSG",
    "role": "BO",
    "price": 8.5,
    "owner": "Mansur"
  },
  {
    "name": "Arjun Tendulkar",
    "team": "LSG",
    "role": "BO",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "Arshin Kulkarni",
    "team": "LSG",
    "role": "AL",
    "price": 7,
    "owner": "Tamil"
  },
  {
    "name": "Avesh Khan",
    "team": "LSG",
    "role": "BO",
    "price": 8.5,
    "owner": "Johny"
  },
  {
    "name": "Ayush Badoni",
    "team": "LSG",
    "role": "BA",
    "price": 7.5,
    "owner": "Bala"
  },
  {
    "name": "Digvesh Rathi",
    "team": "LSG",
    "role": "BO",
    "price": 7.5,
    "owner": "Saravana"
  },
  {
    "name": "George Linde",
    "team": "LSG",
    "role": "AL",
    "price": 7,
    "owner": "Tamil"
  },
  {
    "name": "Himmat Singh",
    "team": "LSG",
    "role": "BA",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "Josh Inglis",
    "team": "LSG",
    "role": "WK",
    "price": 8,
    "owner": "Tamil"
  },
  {
    "name": "Manimaran Siddharth",
    "team": "LSG",
    "role": "BO",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "Matthew Breetzke",
    "team": "LSG",
    "role": "BA",
    "price": 7.5,
    "owner": "Available"
  },
  {
    "name": "Mayank Yadav",
    "team": "LSG",
    "role": "BO",
    "price": 7,
    "owner": "Murali"
  },
  {
    "name": "Mitchell Marsh",
    "team": "LSG",
    "role": "AL",
    "price": 9,
    "owner": "Pandiyan"
  },
  {
    "name": "Mohammed Shami",
    "team": "LSG",
    "role": "BO",
    "price": 8,
    "owner": "Jeba"
  },
  {
    "name": "Mohsin Khan",
    "team": "LSG",
    "role": "BO",
    "price": 7.5,
    "owner": "Pandiyan"
  },
  {
    "name": "Mukul Choudhary",
    "team": "LSG",
    "role": "BA",
    "price": 7,
    "owner": "Pandiyan"
  },
  {
    "name": "Naman Tiwari",
    "team": "LSG",
    "role": "BO",
    "price": 7,
    "owner": "Jeba"
  },
  {
    "name": "Nicholas Pooran",
    "team": "LSG",
    "role": "WK",
    "price": 9.5,
    "owner": "Murali"
  },
  {
    "name": "Prince Yadav",
    "team": "LSG",
    "role": "BO",
    "price": 7,
    "owner": "Sashi"
  },
  {
    "name": "Rishabh Pant",
    "team": "LSG",
    "role": "WK",
    "price": 9,
    "owner": "Mansur"
  },
  {
    "name": "Shahbaz Ahmed",
    "team": "LSG",
    "role": "AL",
    "price": 8,
    "owner": "Available"
  },
  {
    "name": "Wanindu Hasaranga",
    "team": "LSG",
    "role": "AL",
    "price": 8.5,
    "owner": "Tamil"
  },
  {
    "name": "AM Ghazanfar",
    "team": "MI",
    "role": "BO",
    "price": 7,
    "owner": "Sashi"
  },
  {
    "name": "Ashwani Kumar",
    "team": "MI",
    "role": "BO",
    "price": 7,
    "owner": "Bala"
  },
  {
    "name": "Atharva Ankolekar",
    "team": "MI",
    "role": "AL",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "Corbin Bosch",
    "team": "MI",
    "role": "AL",
    "price": 7.5,
    "owner": "Johny"
  },
  {
    "name": "Danish Malewar",
    "team": "MI",
    "role": "BA",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "Deepak Chahar",
    "team": "MI",
    "role": "BO",
    "price": 8.5,
    "owner": "Saravana"
  },
  {
    "name": "Hardik Pandya",
    "team": "MI",
    "role": "AL",
    "price": 11,
    "owner": "Saravana"
  },
  {
    "name": "Jasprit Bumrah",
    "team": "MI",
    "role": "BO",
    "price": 10,
    "owner": "Mansur"
  },
  {
    "name": "Keshav Maharaj",
    "team": "MI",
    "role": "BO",
    "price": 7.5,
    "owner": "Bala"
  },
  {
    "name": "Krish Bhagat",
    "team": "MI",
    "role": "BO",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "Mayank Markande",
    "team": "MI",
    "role": "BO",
    "price": 7.5,
    "owner": "Tamil"
  },
  {
    "name": "Mayank Rawat",
    "team": "MI",
    "role": "AL",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "Mitchell Santner",
    "team": "MI",
    "role": "AL",
    "price": 9,
    "owner": "Bala"
  },
  {
    "name": "Mohd Izhar",
    "team": "MI",
    "role": "BO",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "Naman Dhir",
    "team": "MI",
    "role": "BA",
    "price": 7,
    "owner": "Sashi"
  },
  {
    "name": "Quinton de Kock",
    "team": "MI",
    "role": "WK",
    "price": 9,
    "owner": "Johny"
  },
  {
    "name": "Raghu Sharma",
    "team": "MI",
    "role": "BO",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "Raj Bawa",
    "team": "MI",
    "role": "AL",
    "price": 7.5,
    "owner": "Available"
  },
  {
    "name": "Robin Minz",
    "team": "MI",
    "role": "WK",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "Rohit Sharma",
    "team": "MI",
    "role": "BA",
    "price": 9,
    "owner": "Tamil"
  },
  {
    "name": "Ryan Rickelton",
    "team": "MI",
    "role": "WK",
    "price": 8,
    "owner": "Jeba"
  },
  {
    "name": "Shardul Thakur",
    "team": "MI",
    "role": "BO",
    "price": 8,
    "owner": "Pandiyan"
  },
  {
    "name": "Sherfane Rutherford",
    "team": "MI",
    "role": "BA",
    "price": 8,
    "owner": "Tamil"
  },
  {
    "name": "Suryakumar Yadav",
    "team": "MI",
    "role": "BA",
    "price": 10,
    "owner": "Murali"
  },
  {
    "name": "Tilak Varma",
    "team": "MI",
    "role": "AL",
    "price": 8.5,
    "owner": "Sashi"
  },
  {
    "name": "Trent Boult",
    "team": "MI",
    "role": "BO",
    "price": 9,
    "owner": "Bala"
  },
  {
    "name": "Will Jacks",
    "team": "MI",
    "role": "AL",
    "price": 8,
    "owner": "Johny"
  },
  {
    "name": "Arshdeep Singh",
    "team": "PBKS",
    "role": "BO",
    "price": 9,
    "owner": "Saravana"
  },
  {
    "name": "Azmatullah Omarzai",
    "team": "PBKS",
    "role": "AL",
    "price": 8,
    "owner": "Pandiyan"
  },
  {
    "name": "Ben Dwarshuis",
    "team": "PBKS",
    "role": "BO",
    "price": 7.5,
    "owner": "Available"
  },
  {
    "name": "Cooper Connolly",
    "team": "PBKS",
    "role": "AL",
    "price": 7,
    "owner": "Tamil"
  },
  {
    "name": "Harnoor Singh",
    "team": "PBKS",
    "role": "BA",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "Harpreet Brar",
    "team": "PBKS",
    "role": "BO",
    "price": 8,
    "owner": "Pandiyan"
  },
  {
    "name": "Lockie Ferguson",
    "team": "PBKS",
    "role": "BO",
    "price": 8.5,
    "owner": "Bala"
  },
  {
    "name": "Marco Jansen",
    "team": "PBKS",
    "role": "AL",
    "price": 8.5,
    "owner": "Murali"
  },
  {
    "name": "Marcus Stoinis",
    "team": "PBKS",
    "role": "AL",
    "price": 9.5,
    "owner": "Mansur"
  },
  {
    "name": "Mitchell Owen",
    "team": "PBKS",
    "role": "BA",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "Musheer Khan",
    "team": "PBKS",
    "role": "AL",
    "price": 7,
    "owner": "Murali"
  },
  {
    "name": "Nehal Wadhera",
    "team": "PBKS",
    "role": "BA",
    "price": 7.5,
    "owner": "Pandiyan"
  },
  {
    "name": "Prabhsimran Singh",
    "team": "PBKS",
    "role": "WK",
    "price": 8,
    "owner": "Saravana"
  },
  {
    "name": "Praveen Dubey",
    "team": "PBKS",
    "role": "BO",
    "price": 7.5,
    "owner": "Available"
  },
  {
    "name": "Priyansh Arya",
    "team": "PBKS",
    "role": "BA",
    "price": 7.5,
    "owner": "Sashi"
  },
  {
    "name": "Pyla Avinash",
    "team": "PBKS",
    "role": "BA",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "Shashank Singh",
    "team": "PBKS",
    "role": "AL",
    "price": 8,
    "owner": "Sashi"
  },
  {
    "name": "Shreyas Iyer",
    "team": "PBKS",
    "role": "BA",
    "price": 9,
    "owner": "Johny"
  },
  {
    "name": "Suryansh Shedge",
    "team": "PBKS",
    "role": "AL",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "Vijaykumar Vyshak",
    "team": "PBKS",
    "role": "BO",
    "price": 7.5,
    "owner": "Bala"
  },
  {
    "name": "Vishal Nishad",
    "team": "PBKS",
    "role": "BO",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "Vishnu Vinod",
    "team": "PBKS",
    "role": "WK",
    "price": 8,
    "owner": "Available"
  },
  {
    "name": "Xavier Bartlett",
    "team": "PBKS",
    "role": "BO",
    "price": 7,
    "owner": "Jeba"
  },
  {
    "name": "Yash Thakur",
    "team": "PBKS",
    "role": "BO",
    "price": 7.5,
    "owner": "Sashi"
  },
  {
    "name": "Yuzvendra Chahal",
    "team": "PBKS",
    "role": "BO",
    "price": 8.5,
    "owner": "Johny"
  },
  {
    "name": "Abhinandan Singh",
    "team": "RCB",
    "role": "BO",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "Bhuvneshwar Kumar",
    "team": "RCB",
    "role": "BO",
    "price": 9,
    "owner": "Murali"
  },
  {
    "name": "Devdutt Padikkal",
    "team": "RCB",
    "role": "BA",
    "price": 8,
    "owner": "Saravana"
  },
  {
    "name": "Jacob Bethell",
    "team": "RCB",
    "role": "AL",
    "price": 7.5,
    "owner": "Jeba"
  },
  {
    "name": "Jacob Duffy",
    "team": "RCB",
    "role": "BO",
    "price": 8,
    "owner": "Tamil"
  },
  {
    "name": "Jitesh Sharma",
    "team": "RCB",
    "role": "WK",
    "price": 8.5,
    "owner": "Murali"
  },
  {
    "name": "Jordan Cox",
    "team": "RCB",
    "role": "WK",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "Josh Hazlewood",
    "team": "RCB",
    "role": "BO",
    "price": 9,
    "owner": "Pandiyan"
  },
  {
    "name": "Kanishk Chouhan",
    "team": "RCB",
    "role": "AL",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "Krunal Pandya",
    "team": "RCB",
    "role": "AL",
    "price": 8.5,
    "owner": "Johny"
  },
  {
    "name": "Mangesh Yadav",
    "team": "RCB",
    "role": "AL",
    "price": 7,
    "owner": "Saravana"
  },
  {
    "name": "Nuwan Thushara",
    "team": "RCB",
    "role": "BO",
    "price": 8,
    "owner": "Bala"
  },
  {
    "name": "Phil Salt",
    "team": "RCB",
    "role": "WK",
    "price": 8.5,
    "owner": "Tamil"
  },
  {
    "name": "Rajat Patidar",
    "team": "RCB",
    "role": "BA",
    "price": 8,
    "owner": "Johny"
  },
  {
    "name": "Rasikh Salam",
    "team": "RCB",
    "role": "BO",
    "price": 7,
    "owner": "Sashi"
  },
  {
    "name": "Richard Gleeson",
    "team": "RCB",
    "role": "BO",
    "price": 7,
    "owner": "Bala"
  },
  {
    "name": "Romario Shepherd",
    "team": "RCB",
    "role": "AL",
    "price": 8,
    "owner": "Bala"
  },
  {
    "name": "Satvik Deswal",
    "team": "RCB",
    "role": "BO",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "Suyash Sharma",
    "team": "RCB",
    "role": "BO",
    "price": 7,
    "owner": "Jeba"
  },
  {
    "name": "Swapnil Singh",
    "team": "RCB",
    "role": "BO",
    "price": 8,
    "owner": "Bala"
  },
  {
    "name": "Tim David",
    "team": "RCB",
    "role": "BA",
    "price": 8.5,
    "owner": "Mansur"
  },
  {
    "name": "Venkatesh Iyer",
    "team": "RCB",
    "role": "AL",
    "price": 8.5,
    "owner": "Sashi"
  },
  {
    "name": "Vicky Ostwal",
    "team": "RCB",
    "role": "BO",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "Vihaan Malhotra",
    "team": "RCB",
    "role": "AL",
    "price": 7,
    "owner": "Pandiyan"
  },
  {
    "name": "Virat Kohli",
    "team": "RCB",
    "role": "BA",
    "price": 9,
    "owner": "Tamil"
  },
  {
    "name": "Yash Dayal",
    "team": "RCB",
    "role": "BO",
    "price": 7.5,
    "owner": "Sashi"
  },
  {
    "name": "Adam Milne",
    "team": "RR",
    "role": "BO",
    "price": 8.5,
    "owner": "Tamil"
  },
  {
    "name": "Aman Rao",
    "team": "RR",
    "role": "BA",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "Brijesh Sharma",
    "team": "RR",
    "role": "BO",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "Dasun Shanaka",
    "team": "RR",
    "role": "AL",
    "price": 7.5,
    "owner": "Mansur"
  },
  {
    "name": "Dhruv Jurel",
    "team": "RR",
    "role": "WK",
    "price": 8,
    "owner": "Sashi"
  },
  {
    "name": "Donovan Ferreira",
    "team": "RR",
    "role": "AL",
    "price": 8,
    "owner": "Available"
  },
  {
    "name": "Jofra Archer",
    "team": "RR",
    "role": "BO",
    "price": 8.5,
    "owner": "Jeba"
  },
  {
    "name": "Kuldeep Sen",
    "team": "RR",
    "role": "BO",
    "price": 7.5,
    "owner": "Available"
  },
  {
    "name": "Kwena Maphaka",
    "team": "RR",
    "role": "BO",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "Lhuan-dre Pretorius",
    "team": "RR",
    "role": "WK",
    "price": 7,
    "owner": "Pandiyan"
  },
  {
    "name": "Nandre Burger",
    "team": "RR",
    "role": "BO",
    "price": 7.5,
    "owner": "Available"
  },
  {
    "name": "Ravi Bishnoi",
    "team": "RR",
    "role": "BO",
    "price": 8.5,
    "owner": "Mansur"
  },
  {
    "name": "Ravi Singh",
    "team": "RR",
    "role": "BA",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "Ravindra Jadeja",
    "team": "RR",
    "role": "AL",
    "price": 9,
    "owner": "Murali"
  },
  {
    "name": "Riyan Parag",
    "team": "RR",
    "role": "BA",
    "price": 8.5,
    "owner": "Tamil"
  },
  {
    "name": "Sam Curran",
    "team": "RR",
    "role": "AL",
    "price": 8.5,
    "owner": "Mansur"
  },
  {
    "name": "Sandeep Sharma",
    "team": "RR",
    "role": "BO",
    "price": 8.5,
    "owner": "Bala"
  },
  {
    "name": "Shimron Hetmyer",
    "team": "RR",
    "role": "BA",
    "price": 8.5,
    "owner": "Mansur"
  },
  {
    "name": "Shubham Dubey",
    "team": "RR",
    "role": "BA",
    "price": 7.5,
    "owner": "Bala"
  },
  {
    "name": "Sushant Mishra",
    "team": "RR",
    "role": "BO",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "Tushar Deshpande",
    "team": "RR",
    "role": "BO",
    "price": 8,
    "owner": "Saravana"
  },
  {
    "name": "Vaibhav Sooryavanshi",
    "team": "RR",
    "role": "BA",
    "price": 8,
    "owner": "Tamil"
  },
  {
    "name": "Vignesh Puthur",
    "team": "RR",
    "role": "BO",
    "price": 7,
    "owner": "Saravana"
  },
  {
    "name": "Yash Raj Punja",
    "team": "RR",
    "role": "BO",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "Yashasvi Jaiswal",
    "team": "RR",
    "role": "BA",
    "price": 9,
    "owner": "Johny"
  },
  {
    "name": "Yudhvir Singh",
    "team": "RR",
    "role": "BO",
    "price": 7.5,
    "owner": "Bala"
  },
  {
    "name": "Abhishek Sharma",
    "team": "SRH",
    "role": "AL",
    "price": 8.5,
    "owner": "Pandiyan"
  },
  {
    "name": "Amit Kumar",
    "team": "SRH",
    "role": "BO",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "Aniket Verma",
    "team": "SRH",
    "role": "BA",
    "price": 7.5,
    "owner": "Saravana"
  },
  {
    "name": "Brydon Carse",
    "team": "SRH",
    "role": "AL",
    "price": 8,
    "owner": "Available"
  },
  {
    "name": "David Payne",
    "team": "SRH",
    "role": "BO",
    "price": 7,
    "owner": "Tamil"
  },
  {
    "name": "Dilshan Madushanka",
    "team": "SRH",
    "role": "BO",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "Eshan Malinga",
    "team": "SRH",
    "role": "BO",
    "price": 7,
    "owner": "Sashi"
  },
  {
    "name": "Harsh Dubey",
    "team": "SRH",
    "role": "AL",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "Harshal Patel",
    "team": "SRH",
    "role": "BO",
    "price": 8.5,
    "owner": "Murali"
  },
  {
    "name": "Heinrich Klaasen",
    "team": "SRH",
    "role": "WK",
    "price": 8.5,
    "owner": "Jeba"
  },
  {
    "name": "Ishan Kishan",
    "team": "SRH",
    "role": "WK",
    "price": 9,
    "owner": "Bala"
  },
  {
    "name": "Jack Edwards",
    "team": "SRH",
    "role": "AL",
    "price": 7,
    "owner": "Tamil"
  },
  {
    "name": "Jaydev Unadkat",
    "team": "SRH",
    "role": "BO",
    "price": 8,
    "owner": "Johny"
  },
  {
    "name": "Kamindu Mendis",
    "team": "SRH",
    "role": "AL",
    "price": 8,
    "owner": "Tamil"
  },
  {
    "name": "Krains Fuletra",
    "team": "SRH",
    "role": "BO",
    "price": 7,
    "owner": "Pandiyan"
  },
  {
    "name": "Liam Livingstone",
    "team": "SRH",
    "role": "AL",
    "price": 8.5,
    "owner": "Jeba"
  },
  {
    "name": "Nitish Kumar Reddy",
    "team": "SRH",
    "role": "AL",
    "price": 8.5,
    "owner": "Mansur"
  },
  {
    "name": "Onkar Tarmale",
    "team": "SRH",
    "role": "BO",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "Pat Cummins",
    "team": "SRH",
    "role": "BO",
    "price": 9,
    "owner": "Johny"
  },
  {
    "name": "Praful Hinge",
    "team": "SRH",
    "role": "BO",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "Ravichandran Smaran",
    "team": "SRH",
    "role": "BA",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "RS Ambrish",
    "team": "SRH",
    "role": "AL",
    "price": 7,
    "owner": "Jeba"
  },
  {
    "name": "Sakib Hussain",
    "team": "SRH",
    "role": "BO",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "Salil Arora",
    "team": "SRH",
    "role": "WK",
    "price": 7,
    "owner": "Sashi"
  },
  {
    "name": "Shivam Mavi",
    "team": "SRH",
    "role": "AL",
    "price": 7,
    "owner": "Jeba"
  },
  {
    "name": "Shivang Kumar",
    "team": "SRH",
    "role": "BO",
    "price": 7,
    "owner": "Available"
  },
  {
    "name": "Travis Head",
    "team": "SRH",
    "role": "BA",
    "price": 9,
    "owner": "Bala"
  },
  {
    "name": "Zeeshan Ansari",
    "team": "SRH",
    "role": "BO",
    "price": 7.5,
    "owner": "Saravana"
  }
];
