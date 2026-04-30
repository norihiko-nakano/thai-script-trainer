# Thai Script Trainer

A mobile-friendly Thai script memorization app for Japanese beginners.

This is a portfolio project developed by **Norihiko Nakano** as part of my learning journey in the **TUXSA AIoT Program**.

## Live Demo

https://norihiko-nakano.github.io/thai-script-trainer/

## GitHub Repository

https://github.com/norihiko-nakano/thai-script-trainer

## Overview

Thai Script Trainer is a prototype learning app for Japanese beginners who want to become familiar with Thai script and Thai keyboard input.

The app uses emoji-based prompts.  
Learners see an emoji, think of the Japanese word, check the Romaji, and type the sound using Thai characters.

Example:

```text
🦛
Japanese: かば
Romaji: KABA
Basic Thai Script: กา บา
Natural Thai: ฮิปโป / ฮิปโปโปเตมัส

This app is not designed to teach formal Thai spelling at the beginning stage.
Instead, it uses Basic Thai Script as a temporary bridge to reduce the psychological barrier of unfamiliar Thai characters.

Definitions
Basic Thai Script

Basic Thai Script means a temporary learning notation that represents Japanese sounds using Thai characters.
It is designed for beginner input practice and is not formal Thai spelling.

Natural Thai

Natural Thai means the standard Thai word or expression used by native Thai speakers.

Target Users

This app is designed for:

Japanese adults beginning to study Thai
Middle-aged Japanese learners who feel difficulty memorizing Thai script
Japanese people living in or planning to move to Thailand
Learners who want to practice using a real Thai keyboard on their smartphone
Current MVP Features

The current MVP includes:

Emoji-based animal prompts
Japanese word and Romaji display
Thai keyboard input practice
Thai-character-only validation
Space-normalized answer matching
Example: กา บา and กาบา are both accepted
3-question sequential test flow
Final score display
Per-question answer review
Comparison between Basic Thai Script and Natural Thai
Mobile browser testing
Tech Stack
Frontend
HTML
CSS
JavaScript
GitHub Pages
Data Processing
Python
Pandas
NumPy
CSV
JSON
Data Pipeline

Question data is managed in CSV format and converted into JSON for the web application.

questions.csv
↓
Python + Pandas + NumPy
↓
questions.json
↓
HTML / CSS / JavaScript web app
Role of Pandas

Pandas is used to:

Load the question dataset from CSV
Validate required columns
Check missing values
Convert accepted answer candidates into lists
Convert tags into lists
Role of NumPy

NumPy is used for basic statistical checks, such as:

Number of accepted answers per question
Average number of accepted answers
Minimum and maximum accepted answer counts
Project Structure
thai-script-trainer/
├── index.html
├── questions.csv
├── questions.json
├── make_questions_json.py
└── README.md
How to Run Locally
1. Install required Python libraries
pip install pandas numpy
2. Generate questions.json from questions.csv
python make_questions_json.py
3. Start a local server
python -m http.server 8000
4. Open the app in a browser
http://localhost:8000

To test on a smartphone, connect the PC and smartphone to the same Wi-Fi network and open:

http://YOUR_PC_IP_ADDRESS:8000
Example Question Data
id,emoji,japanese,romaji,basic_thai,accepted_answers,natural_thai,tags
1,🦛,かば,KABA,กา บา,กา บา|กาบา,ฮิปโป / ฮิปโปโปเตมัส,animal
2,🐘,ぞう,ZOU,โซ อุ,โซ อุ|โซอุ,ช้าง,animal
3,🐱,ねこ,NEKO,เน โก,เน โก|เนโก,แมว,animal
4,🐶,いぬ,INU,อิ นุ,อิ นุ|อินุ,หมา / สุนัข,animal
Future Work
1. AI-based Input Pattern Analysis

Future versions will collect anonymized learner input data and analyze common input patterns.

For example, the system may detect that many learners use า for the Japanese sound あ.

The app can then provide personalized feedback such as:

You often use า for あ-like sounds.
Other learners use several different Thai vowel patterns.
Try another pattern next time.
2. Evolving Answer Database

The accepted answer candidates will not be fixed.

Future versions may allow:

Learners to propose new answer candidates
Machine learning models to suggest common input patterns
Thai native speakers to validate or reject proposed candidates
3. Native Speaker Validation

Thai native speakers will review proposed answer candidates to prevent incorrect patterns from being accepted.

For example:

ซ is not an appropriate answer candidate for the Japanese sound あ.
4. ML-based Difficulty Estimation

Future versions will estimate question difficulty using machine learning.

The model may use features such as:

Japanese word length
Romaji length
Basic Thai Script length
Vowel pattern complexity
Word familiarity
Learner accuracy
Input time
Error rate

The model will learn feature weights from anonymized learner logs and calculate a difficulty score for each question.

This can support adaptive learning by showing easier questions first and introducing more difficult questions gradually.

Portfolio Purpose

This project demonstrates:

Web app prototyping with HTML, CSS, and JavaScript
Mobile-friendly learning app design
Thai keyboard input validation
CSV-based dataset management
Python-based preprocessing
Pandas and NumPy usage
Future AI and machine learning extension design
Author

Norihiko Nakano
TUXSA AIoT Program
2026

Copyright

© 2026 Norihiko Nakano. All rights reserved.
