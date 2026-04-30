# Thai Script Trainer

A mobile-friendly Thai script learning prototype for Japanese beginners.

## Overview

This app helps Japanese beginners become familiar with Thai script by using emoji-based prompts, Japanese words, Romaji, and Thai keyboard input practice.

Example:

🦛 → かば / KABA → กา บา

## Features

- Emoji-based prompts
- Japanese and Romaji display
- Thai keyboard input practice
- Thai-character-only validation
- Space-normalized answer matching
- Three-question test flow
- Final score review
- CSV-based question data management
- Python preprocessing with Pandas and NumPy

## Tech Stack

- HTML
- CSS
- JavaScript
- Python
- Pandas
- NumPy
- CSV
- JSON

## Data Pipeline

Question data is managed in CSV format and preprocessed with Python.
Pandas is used for dataset loading and validation, while NumPy is used for simple statistical checks.
The processed data is exported as JSON and loaded by the web application.

## Future Work

- Server-side learner input logging
- AI-based input pattern analysis
- Machine learning-based answer candidate suggestion
- Native speaker validation
