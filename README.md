![Build Status](https://github.com/ianw11/DraftLobbyBot/workflows/UnitTests/badge.svg)

# Looking for Game - The Discord Bot
Do you have a discord server that likes to schedule events/games? Do you find organizing these events is akin to herding cats?  Here is your solution!

## Table of Contents
* [Overview](#overview)
* [The bot is on my server and <b>I JUST WANT TO KNOW HOW TO JOIN EVENTS</b>](#user-guide)
* [The bot is on my server and I want to create/host an event](#session-creator)
* [I want the bot on my server](#installation)

## Overview

This bot facilitates creating lobbies that other Discord users in your server can join.  It lets you specify a date and time, give a title/description, and set a capacity.  The bot will keep track of who has joined (as well as in what order) and supports a waitlist (in case the event is a little _too_ popular).


## User Guide
> ### <b>To join an event, tap the emoji.  That's it.</b>

The bot will DM you and let you know if you are confirmed or waitlisted.  When the event starts, you will receive another DM.  If you are waitlisted and enough people leave that you get added, you will receive another DM.  If the event gets cancelled, you guessed it, you'll receive another DM.

To leave an event after joined, de-select the emoji.

If you can't remember what you're signed up for, `!list` will DM you what you've joined.

> You can get a quick reference of all this if you send `!help` in your server

## Session Creator

### Create session
To create a session, use `!create`.
> Each discord user may only have 1 event at a time.  If you have an active event when you attempt to create a new one, the old one will be closed (all attendees notified) and a new one will be created.

The ability to create sessions with a template (ie something like `!create winston_draft`) is being looked at.

### Modify session information
There are a variety of fields you can modify.  They all start off the same way: `!edit <field> <value>`. Replace \<field> with one of the following fields and \<value> with the value you want.

Fields: 
- name
- capacity
- d (or description)
- date
- fire
- url

#### Examples:
`!edit name Casual Fridays` will set the session's name to "Casual Fridays"

`!edit capacity 2` will set the capacity to 2 (and waitlist anybody above)

`!edit d This is describing my event` will change the description to "This is describing my event"

`!edit date 8 22 17:30` will set the date to Aug 22 at 5:30pm
> Note: the bot only understands in the form `mm dd hh:mm`.  This is planned to be expanded on

> Note: the time chosen will be in the timezone the SERVER is on, NOT YOU. This has less potential to be changed (timezones are really hard in software), so use Google to adjust for you

`!edit fire true` will turn off the waitlist and will fire as SOON as capacity is reached.  Sessions default to `false` which means the creator needs to manually start the event

`!edit url <url>` will change the url the bot will send on start.  Currently it will autogenerate a mtgadraft.herokuapp.com session. 


### Broadcast message to attendees
As it may be necessary to send a quick update to the attendees, you can do so with `!broadcast [all] <message>`.  The `[all]` means you can optionally include "all" to include the waitlist.

Replace \<message> with the actual message you want, for example: `!broadcast The event is being moved back 30 minutes`

Include the waitlist: `!broadcast all I'm increasing the capacity to 16 thanks to increased interest`

### Get session information
To see session information, including who is currently signed up/waitlisted, use `!info`

### Start session
When everything looks ready to go, use `!start`

### Delete/Close session
`!delete`.  This notifies everybody who's joined/waitlisted.

## Installation

Head over to the [installation guide](docs/setup.md) (still a work in progress)
