Object.assign(process.env, {
  NODE_ENV: 'test',
  MONGODB_URI: 'mongodb://127.0.0.1:27017/caresync-test',
  JWT_ACCESS_SECRET: 'test-only-access-secret-long-enough-for-validation',
  JWT_REFRESH_SECRET: 'test-only-refresh-secret-long-enough-for-validation',
});
