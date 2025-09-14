# Jailbreak Private Server Bot

A Discord bot designed to help communities manage and share Jailbreak (Roblox game) private servers. The bot allows users to submit private server links, verifies them automatically, and maintains a live-updating list of all submissions with moderation capabilities.

## Features

- **User Submission System**: Modal-based form for submitting private server links
- **Automatic Verification**: Checks if links point to legitimate Jailbreak private servers
- **Live Server List**: Pinned message that automatically updates with all submissions
- **Moderation Tools**: Commands for approving, rejecting, or deleting submissions
- **Roblox Integration**: Optional Roblox username linking with profile integration
- **Persistent Storage**: All data saved to JSON file for persistence between restarts

## Client-Side (User Experience)

### For Regular Users:
- Click the "Submit Private Server" button in the designated channel
- Fill out the modal form with:
  - Private server share link (required)
  - Roblox username (optional)
- Receive immediate feedback on submission status
- View all submitted servers in the live list channel

### For Moderators:
- Use text commands to manage submissions:
  - `approve [link]` - Mark a server as verified
  - `reject [link]` - Mark a server as rejected
  - `delete [link]` - Remove a server from the list
- All changes instantly update the live list

## Server-Side (Technical Implementation)

### Bot Architecture:
- **Discord.js v14**: Modern Discord API integration
- **Modal Interactions**: User-friendly form submissions
- **Embed Management**: Dynamic, formatted server listings
- **Persistence System**: JSON-based data storage with automatic backups

### Verification System:
- URL validation to ensure proper Roblox share links
- HTTP requests to verify game association with Jailbreak
- Security measures against malicious links

### Automation Features:
- Automatic message recreation if bot messages are deleted
- Sequential ID management for organized listings
- Real-time embed updates across all submissions

## Setup Instructions

1. Clone this repository
2. Install dependencies: `npm install`
3. Create a `.env` file with your Discord bot token
4. Configure channel IDs in `bot.js` for your server
5. Run the bot: `node bot.js`

## Requirements

- Node.js 16.9.0 or higher
- Discord.js v14
- A Discord bot token with appropriate permissions
- Server with text channels for button and live list functionality

The bot provides a complete solution for communities to collect, verify, and display Jailbreak private servers in an organized, automated way.
