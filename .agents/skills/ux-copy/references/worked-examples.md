# Four worked examples

The process, from the whole set to the final strings. Every screen here is made up for this skill: illustrative, not taken from a product. Copy the process, not the sentences. A screen's own facts decide its words.

Numbers and names appear as placeholders in braces, because they come from data through the formatter (R10). Where an example assumes a fact about the product, it says so, and the fact is checked against the code or the spec before the string ships.

## 1. Empty search results

A search page in a document library. The screen holds seven strings.

| Key            | Element     | String                                                                                                                                         |
| -------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `page.title`   | page title  | Search Results                                                                                                                                 |
| `page.lead`    | lead        | Here you can find all of the results that match your search query.                                                                             |
| `empty.title`  | empty state | Oops! No results found!                                                                                                                        |
| `empty.body`   | empty state | Unfortunately, we were unable to find any results matching your search. Please try adjusting your search terms or filters, or try again later. |
| `search.hint`  | hint        | Tip: You can use keywords to search for documents.                                                                                             |
| `empty.action` | button      | Clear All Filters and Try Again                                                                                                                |
| `page.footer`  | notice      | Our powerful search engine scans thousands of documents to bring you the most relevant results.                                                |

Written as an idea table:

| String                                        | Element     | The one idea                                                  | Decision                                                                                                                                 |
| --------------------------------------------- | ----------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Search Results                                | page title  | what the page is                                              | keep, in sentence case: "Search results" (R10)                                                                                           |
| Here you can find all of the results...       | lead        | the title again                                               | delete (R2, R5)                                                                                                                          |
| Oops! No results found!                       | empty state | nothing matched                                               | keep the idea as a fact, with what was searched: `No results for "{query}"` (R1, M8, V5)                                                 |
| Unfortunately, we were unable to find...      | empty state | nothing matched again, change the terms or filters, try later | fold the first idea into the title (R5, V5, T12). Keep one way forward. Cut "try again later": results do not change by themselves (R2). |
| Tip: You can use keywords...                  | hint        | how to search                                                 | delete: the field's placeholder already says what to type (R5), and "You can" adds nothing (T4)                                          |
| Clear All Filters and Try Again               | button      | remove the filters and search again                           | one action that names the result: "Clear filters", shown only when a filter is on (R8)                                                   |
| Our powerful search engine scans thousands... | notice      | the engine is good, and a number nobody supplied              | delete (R2, R7, M2). The number is an invented claim.                                                                                    |

The final strings:

| Element                              | String                                 |
| ------------------------------------ | -------------------------------------- |
| page title                           | Search results                         |
| empty state, title                   | No results for "{query}"               |
| empty state, body (no filter is on)  | Check the spelling or try fewer words. |
| empty state, button (a filter is on) | Clear filters                          |

Seven strings became four, and each state shows one way forward. What decided it: "nothing matched" sat in three strings (R5). The lead restated the title (R2). The footer was praise and an invented figure (R2, R7). The button did two things and so named neither (R8). The way forward depends on state: with a filter on, the button does it, and with none on, the advice does.

Left for you to check: whether "Check the spelling" suits this product. It assumes typed queries.

## 2. A failed file upload

An upload area that reports one failure per file. The screen holds seven strings.

| Key                   | Element                | String                                                                                                                                                      |
| --------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `upload.error.title`  | notice title           | Upload Failed                                                                                                                                               |
| `upload.error.body`   | notice body            | Oops! Something went wrong while uploading your file. Please check your internet connection and try again. If the problem persists, please contact support. |
| `upload.error.detail` | detail line            | Error: 413 Payload Too Large. The request entity exceeds the configured limit of 10MB (MAX_UPLOAD_BYTES).                                                   |
| `upload.error.retry`  | button                 | Try Again                                                                                                                                                   |
| `upload.error.cancel` | button                 | Cancel                                                                                                                                                      |
| `upload.row.retry`    | link in the file's row | Retry                                                                                                                                                       |
| `upload.toast.done`   | toast                  | File uploaded successfully!                                                                                                                                 |

| String                          | Element      | The one idea                                                                      | Decision                                                                                                                                                                                                                                    |
| ------------------------------- | ------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Upload Failed                   | notice title | the upload did not happen                                                         | keep, with the file's name, answer first: `{filename} didn't upload` (R3, R10)                                                                                                                                                              |
| Oops! Something went wrong...   | notice body  | a failure again, check the connection, try again, contact support                 | keep one idea, the cause, and only when the code knows it. Delete "Oops" and "Something went wrong" (M8, V5), the connection advice and the retry sentence (R5, because the button makes it), and "contact support" (a default, see below). |
| Error: 413 Payload Too Large... | detail line  | the cause as a status code and a config name                                      | the cause in the user's terms, with the limit from config: "The limit is {limit}." (R7). The code and the name stay in the logs.                                                                                                            |
| Try Again                       | button       | retry                                                                             | keep: "Try again" (R10)                                                                                                                                                                                                                     |
| Cancel                          | button       | take the failed file out of the list. It is ambiguous: the upload already failed. | "Remove file" (R8)                                                                                                                                                                                                                          |
| Retry                           | link         | retry again                                                                       | delete. The notice's button does it (R5), and "Retry" against "Try again" is two words for one idea (R6).                                                                                                                                   |
| File uploaded successfully!     | toast        | the upload finished                                                               | `{filename} uploaded`: the past-tense fact, with no "successfully" and no "!" (R1, T10)                                                                                                                                                     |

The code knows why a file failed, so the strings are a lookup by reason:

| Reason the code reports         | Title                                  | Body                    | Buttons                |
| ------------------------------- | -------------------------------------- | ----------------------- | ---------------------- |
| the file is over the size limit | {filename} is too large                | The limit is {limit}.   | Choose another file    |
| the file type is not accepted   | {filename} isn't a supported file type | Upload {types}.         | Choose another file    |
| the connection dropped          | {filename} didn't upload               | The connection dropped. | Try again, Remove file |
| no reason known                 | {filename} didn't upload               | (no body)               | Try again, Remove file |

What decided it. The old body held four ideas and its retry sentence repeated its button. A cause is written only when the code knows it: "The connection dropped" is shown for a connection failure and for nothing else, because claiming it for an unknown failure would invent a cause. The status code and the config name are internals. `{limit}` and `{types}` are formatted values from config.

Left for you to check: whether to offer a support link after a second failure. If the product has a real support path, offer it once, as a link. That is a product decision.

## 3. A usage limit reached

A banner that appears when a plan's monthly searches are used up. The screen holds six strings.

| Key               | Element                               | String                                                                                                                                                         |
| ----------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `limit.title`     | banner title                          | Oh no! You've reached your monthly limit!                                                                                                                      |
| `limit.body`      | banner body                           | Unfortunately, you have used all 50 of your free searches for this billing period. To continue enjoying our powerful features, please upgrade your plan today! |
| `limit.action`    | button                                | Upgrade Now!                                                                                                                                                   |
| `limit.reset`     | hint                                  | Your limit will reset automatically on the 1st of next month at 00:00 UTC based on our billing cycle.                                                          |
| `search.disabled` | tooltip on the disabled search button | You cannot perform this action at this time.                                                                                                                   |
| `usage.meter`     | meter                                 | Plan usage: 50/50 searches used                                                                                                                                |

| String                                            | Element      | The one idea                                                                   | Decision                                                                                                                                                                   |
| ------------------------------------------------- | ------------ | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Oh no! You've reached your monthly limit!         | banner title | the limit is reached                                                           | keep as a fact: "Monthly search limit reached" (R1, M8, V5)                                                                                                                |
| Unfortunately, you have used all 50...            | banner body  | the limit is reached again, the figure, "enjoy our powerful features", upgrade | cut the apology, the praise and the urgency (V5, M2, R1). The figure belongs to the meter (R5) and comes from data (R10).                                                  |
| Upgrade Now!                                      | button       | how to get more                                                                | keep as the verb and the result: "Upgrade plan" (R1, R8)                                                                                                                   |
| Your limit will reset automatically on the 1st... | hint         | when it resets                                                                 | keep the date, the one fact a user can act on: "Searches reset on {date}." Cut "automatically", the clock time, the zone and the billing cycle: how the system works (R7). |
| You cannot perform this action at this time.      | tooltip      | why the button is disabled                                                     | delete: the banner above says it (R5), and the sentence says nothing (T12, T10)                                                                                            |
| Plan usage: 50/50 searches used                   | meter        | usage so far                                                                   | a label and a value from data: "Searches this month", "{used} of {limit}" (R10)                                                                                            |

The final strings:

| Element                        | String                                 |
| ------------------------------ | -------------------------------------- |
| banner title                   | Monthly search limit reached           |
| banner body                    | Searches reset on {date}.              |
| button                         | Upgrade plan                           |
| tooltip on the disabled button | (deleted)                              |
| meter label, value             | Searches this month, {used} of {limit} |

A limit is a fact with a way forward, and here there are two: wait for the date, or upgrade. The title gives the verdict first (R3).

Check the rewrite for the fact it dropped. "Your free searches" said the plan is free. If paid plans see this banner too, the new strings are true for both. If the disabled button is the only place the limit shows, because the banner is not on that screen, keep the tooltip as the short fact: "Monthly search limit reached".

Left for you to check: whether the reset time matters to your users. If the limit resets at midnight in one fixed zone and users near that boundary would be misled by a date alone, the zone is a fact worth keeping.

## 4. A settings form

An account page with a profile form, a notification switch and an account deletion dialog. The screen holds eighteen strings.

| Key                               | Element        | String                                                                                                                                                          |
| --------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `page.title`                      | page title     | Account Settings Page                                                                                                                                           |
| `page.lead`                       | lead           | Manage your account settings and preferences here. You can update your personal information, change your password, and configure your notification preferences. |
| `name.label`                      | label          | Please enter your full name:                                                                                                                                    |
| `name.hint`                       | hint           | Your name will be displayed to other users of the platform.                                                                                                     |
| `name.placeholder`                | placeholder    | Enter name here                                                                                                                                                 |
| `name.error`                      | error          | The name field is required.                                                                                                                                     |
| `email.label`                     | label          | E-mail Address:                                                                                                                                                 |
| `email.hint`                      | hint           | We will never share your email address with anyone.                                                                                                             |
| `email.error`                     | error          | Invalid email address.                                                                                                                                          |
| `notify.label`                    | switch label   | Enable email notifications                                                                                                                                      |
| `notify.hint`                     | hint           | Toggle this switch to turn email notifications on or off.                                                                                                       |
| `save.button`                     | button         | Submit Changes                                                                                                                                                  |
| `save.toast`                      | toast          | Your changes have been saved successfully!                                                                                                                      |
| `delete.button`                   | button         | Delete My Account                                                                                                                                               |
| `delete.title`                    | dialog title   | Are you sure you want to delete your account?                                                                                                                   |
| `delete.body`                     | dialog body    | This action cannot be undone. All of your data will be permanently deleted.                                                                                     |
| `delete.confirm`, `delete.cancel` | dialog buttons | Yes, No                                                                                                                                                         |

| String                                            | Element        | The one idea                           | Decision                                                                                                                                                                                                |
| ------------------------------------------------- | -------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Account Settings Page                             | page title     | what the page is                       | "Account settings": a noun phrase in sentence case, and "Page" says nothing (R8, R10)                                                                                                                   |
| Manage your account settings...                   | lead           | the sections the page already shows    | delete: the title and the sections say it (R2, R5, T4)                                                                                                                                                  |
| Please enter your full name:                      | label          | the field                              | "Full name": a noun, with no "please" and no colon (R8, T10)                                                                                                                                            |
| Your name will be displayed to other users...     | hint           | who sees the name                      | keep as a fact the user needs: "Other people in your workspace see this name." "The platform" goes (V6, R9). This assumes the product shows the name to teammates. Check it.                            |
| Enter name here                                   | placeholder    | what to type                           | delete: the label says it (R5)                                                                                                                                                                          |
| The name field is required.                       | error          | the field is empty                     | "Enter your full name." What to do covers what happened (R8)                                                                                                                                            |
| E-mail Address:                                   | label          | the field                              | "Email": one spelling, no colon (R6, R8)                                                                                                                                                                |
| We will never share your email address...         | hint           | a promise about privacy                | cut here and decide with the owner (R2). A promise is a fact only if the privacy policy says so. If it stays, it appears once, where the user decides.                                                  |
| Invalid email address.                            | error          | the address is not an email            | "Enter an email like name@example.com." "Invalid" blames and does not help (R8). Microsoft's example is the same move: "Invalid ID" becomes "You need an ID that looks like this: someone@example.com". |
| Enable email notifications                        | switch label   | the switch                             | "Email notifications": a noun, and the switch shows on or off (R8)                                                                                                                                      |
| Toggle this switch to turn email...               | hint           | how a switch works                     | delete: the control makes the idea (R5)                                                                                                                                                                 |
| Submit Changes                                    | button         | save                                   | "Save changes": a verb that names the result. "Submit" is the mechanism (R8, R10).                                                                                                                      |
| Your changes have been saved successfully!        | toast          | saved                                  | "Changes saved": a past-tense fact (R1, T10)                                                                                                                                                            |
| Delete My Account                                 | button         | open the deletion dialog               | "Delete account": "My" adds nothing on a page that is the user's own (R6)                                                                                                                               |
| Are you sure you want to delete your account?     | dialog title   | the decision                           | "Delete account": the same words as the button that opens it, one idea (R6)                                                                                                                             |
| This action cannot be undone. All of your data... | dialog body    | the consequence, that it is final      | "Your projects, files and settings are deleted for good." One sentence, and "for good" says it is final (R4). Check the list against what the code deletes.                                             |
| Yes, No                                           | dialog buttons | answers to a question that is now gone | "Delete" and "Cancel": a verb that names the result, and a word that stops before it happens (R8, R6)                                                                                                   |

The final strings:

| Element        | String                                                  |
| -------------- | ------------------------------------------------------- |
| page title     | Account settings                                        |
| label          | Full name                                               |
| hint           | Other people in your workspace see this name.           |
| error          | Enter your full name.                                   |
| label          | Email                                                   |
| error          | Enter an email like name@example.com.                   |
| switch label   | Email notifications                                     |
| button         | Save changes                                            |
| toast          | Changes saved                                           |
| button         | Delete account                                          |
| dialog title   | Delete account                                          |
| dialog body    | Your projects, files and settings are deleted for good. |
| dialog buttons | Delete, Cancel                                          |

Eighteen strings became fourteen. The field error and its summary link, if the form has one, are the allowed repeat of R5: same words, so they match.

Check each rewrite for the fact it dropped. "All of your data" can be wider than what the product deletes: billing records and backups may stay. "Your projects, files and settings" is true only if that is the list. "For good" is false if the product keeps a recovery window. Read the deletion code or the spec before the string ships.

Left for you to check: whether the confirm button should say "Delete account" in full. It repeats the title (R5), and it is clearer when skimmed. The project's guide decides. Also whether the email field keeps a privacy promise. Write it only if it is true, and once.
