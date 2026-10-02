// Edit these values. None of them are secrets (the Firebase web config is public by design;
// access is enforced by Okta sign-in plus the Firestore rules, not by hiding this file).
window.APP_CONFIG = {
  // Firebase console > Project settings > Your apps > SDK setup and configuration
  firebase: {
    apiKey: "AIzaSyBbhBhuY1U57TN6qbIKVC378SitNepTe4M",
    authDomain: "wildcats-tracker.firebaseapp.com",
    projectId: "wildcats-tracker",
    appId: "1:663776602342:web:5e976306adb4512486b327",
  },
  // The named Firestore database that holds the branch data (NOT "(default)").
  databaseId: "branch-info",
  // Provider ID shown in Firebase console > Authentication > Sign-in method after your
  // Okta team adds the provider. Must start with "saml." or "oidc.".
  providerId: "saml.okta",
};
