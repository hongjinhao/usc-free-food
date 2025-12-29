Website to show all the free food engagesc events Call this url: https://engage.usc.edu/events.
	- shows an overview of all events. Each event has the title, a picture, date time, tags and organizer.
	- This url is a public website, no sign in or log in is required.
Click into the event to see more details: e.g. https://engage.usc.edu/resed/rsvp_boot?id=408945
	- This page has a description of the event 
	- e.g. "Trojans, to close out week 0, join us for a night of trivia! Come to Tommy's Place as we host a variety of categories, as well as win some prizes for ranking high in the leaderboard. Categories include: Total Trivia, Movie Mania, and Geek Out Trivia. This program is open to all eligible individuals. Late Night 'SC operates all of its programs and activities consistent with the USC’s Notice of Non-Discrimination. Eligibility is not determined based on race, sex, ethnicity, sexual orientation, or any other prohibited factor. Individuals with disabilities who need accommodations to attend this event may contact latenight.sc@usc.edu. We request that individuals requiring accommodations or auxiliary aids, such as sign language interpreters and alternative format materials, notify us at least 7 days prior to the event. Every reasonable effort will be made to provide reasonable accommodations in an effective and timely manner."
	- this url is also public, no sign in or log in is required.

Requirements:
	• Good UI
	• Filter by free food
	• Don't overload USC's endpoints 
	• Fast load times 
	• Use React, JS

Libraries/Framework used: React, Vite, Tailwind, Supabase (database), Vercel (frontend, cron job)
Languages: JS, HTML, CSS

Plan:
	• Understand if I can directly call their backend API endpoint or I have to parse from their frontend
		○ Done, both the list API and the details page has CORS so I need to set up a backend proxy? 
	• Set up React App with Vite
		○ Done, created project, installed dependencies and libraries, pasted in Claude's app.jsx code and started dev server. 
	• Setup backend proxy with Vercel 
		○ Done, APIs can be called now
	• Build the event list parsing for overview information
		○ Done, just get the information we need from the JSON response
	• Build the event details scraping for free food 
		○ Initial attempt done. 
	• Refine free food keyword detection
		○ Added more keywords and understand the parsing logic
	• Design and build front end. Add detail fetching when users click "view details", add a link for registration. 
		○ Semi completed, still needs some polishing 
		○ Time not displayed right, tags not displayed right
		○ Highlight matching keywords
	• Setup Supabase
        - no need for backend proxy now since the database serves as the backend proxy
        *Make sure to adjust app.jsx to reflect this
        - done, create table, setup security policies, configure supabase env, add .env 
    • Clean information before storing in database
        - Done, using regex and html parser
	• Setup backend cron job with vercel 
		○ Done, configure vercel cron to upsert database table every day, setup cron config
	• Update frontend (app.jsx) to read from supabase 
		- done, add order_index, configure .env file
	• Deploy to Vercel/Netlify
		- done
	• Custom domain name? 
	• Gather feedback
	• Improve

Looking at the engagesc events page fetch network calls, it seems to be calling
https://engage.usc.edu/mobile_ws/v17/mobile_events_list?range=0&limit=4&filter4_contains=OR&filter4_notcontains=OR&order=undefined&search_word=&&1766544989878 
	• Range is the starting point (1st event shown)
	• Limit is the total number of events provided

But for the individual events and the details of the event. Is there also an API? 
	• Yes, link is here: https://engage.usc.edu/resed/rsvp_boot?id=408945
	• But it doesn't return JSON, it returns HTML, CSS and JS. 
	• You call the url with the eventID as a query and you get back all the server generated html, css and js. 
	• The very 1st object received is a html document containing the text details. 

Project structure: 
.
├── .env
├── .git
├── .gitignore
├── .prettierignore
├── .vercel
├── .vite
├── README.md
├── api
│   ├── cron-scan-events.js
│   ├── event-details.js
│   └── events.js
├── docs
├── eslint.config.js
├── index.html
├── individualevent.html
├── node_modules
├── package-lock.json
├── package.json
├── public
├── src
│   ├── App.jsx
│   ├── assets
│   ├── index.css
│   └── main.jsx
├── utils
│   └── freeFoodKeywords.js
├── vercel.json
└── vite.config.js
  
To start the react server: '$ npm run dev'  
To start the vercel frontend react server + cron job: '$ vercel dev'
