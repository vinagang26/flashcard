# MVP Setup — Clean, No Supabase Yet

This is a working React MVP with mock data (localStorage). No Supabase yet. Test it locally first, then we add Supabase.

## Files to create/replace

Copy each file below into your project:

```
src/
  ├── App.js                              (replace with 01-App.js)
  ├── index.js                            (replace with 08-index.js)
  ├── styles/
  │   └── index.css                       (replace with 07-index.css)
  ├── pages/
  │   ├── LoginPage.js                    (create from 02-LoginPage.js)
  │   ├── LibraryPage.js                  (create from 03-LibraryPage.js)
  │   └── DeckPage.js                     (create from 04-DeckPage.js)
  └── components/
      ├── CreateDeckModal.js              (create from 05-CreateDeckModal.js)
      └── CreateCardModal.js              (create from 06-CreateCardModal.js)
```

## Step-by-step

1. **Delete the old `src/` folder** (it's polluted from Antigravity)
   ```bash
   cd "c:\Users\Admin\OneDrive\Tài liệu\GitHub\flashcard"
   rm -r src/
   mkdir -p src/pages src/components src/styles
   ```

2. **Copy each file from outputs folder into the right spot**

   On Windows PowerShell:
   ```powershell
   # Pages
   Copy-Item "08-index.js" -Destination "src/index.js" -Force
   Copy-Item "01-App.js" -Destination "src/App.js" -Force
   Copy-Item "02-LoginPage.js" -Destination "src/pages/LoginPage.js" -Force
   Copy-Item "03-LibraryPage.js" -Destination "src/pages/LibraryPage.js" -Force
   Copy-Item "04-DeckPage.js" -Destination "src/pages/DeckPage.js" -Force
   
   # Components
   Copy-Item "05-CreateDeckModal.js" -Destination "src/components/CreateDeckModal.js" -Force
   Copy-Item "06-CreateCardModal.js" -Destination "src/components/CreateCardModal.js" -Force
   
   # Styles
   Copy-Item "07-index.css" -Destination "src/styles/index.css" -Force
   ```

3. **Install dependencies**
   ```bash
   npm install react-router-dom
   ```

4. **Clean git**
   ```bash
   git reset --hard HEAD~6
   git rm -r --cached node_modules 2>/dev/null
   echo "node_modules/" >> .gitignore
   git add .gitignore
   git commit -m "chore: remove node_modules, clean up Antigravity commits"
   ```

5. **Add new files to git**
   ```bash
   git add src/ public/
   git commit -m "chore: MVP skeleton with mock auth + localStorage"
   ```

6. **Run it**
   ```bash
   npm start
   ```

   Should open at `http://localhost:3000`

## Test checklist

- [ ] Sign up with test email/password
- [ ] Redirects to /library (shows "No decks yet")
- [ ] Click "Create New Deck" → modal appears
- [ ] Fill in deck name + language → creates deck
- [ ] Deck appears in list
- [ ] Click deck → goes to /deck/:id (shows "No cards yet")
- [ ] Click "Add Card" → modal appears
- [ ] Fill in front/subback/back → creates card
- [ ] Card appears in deck
- [ ] Refresh page → deck and cards still there
- [ ] Click delete card → gone
- [ ] Log out → back to login page
- [ ] Refresh → login page (session cleared)

If all pass: **MVP works, ready to add Supabase**

## What's mock right now

- **Auth**: localStorage only, no Supabase. `user` object is just `{ id, email }`
- **Decks**: stored in localStorage as JSON
- **Cards**: stored in localStorage as JSON
- **No Supabase client yet** — all data is client-side

## Next step (don't do yet)

After MVP works, we'll:
1. Create Supabase service layer (supabaseClient.js, deckService.js, cardService.js)
2. Replace localStorage calls with Supabase queries
3. Keep the same page/component structure (no UI changes needed)

This is why we test MVP first — the UI logic is solid, and backend swap is just changing the services.
