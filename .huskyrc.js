module.exports = {
  hooks: {
    'pre-commit': 'npm run lint && npm run validate:workflows',
    'commit-msg': 'commitlint -E HUSKY_GIT_PARAMS',
    'pre-push': 'npm run test:all',
  },
};
