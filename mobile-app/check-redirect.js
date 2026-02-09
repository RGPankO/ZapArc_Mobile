const { makeRedirectUri } = require('expo-auth-session');
console.log('Redirect URI:', makeRedirectUri({ scheme: 'mobile-app' }));
