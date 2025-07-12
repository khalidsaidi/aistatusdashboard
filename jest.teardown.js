// Jest Global Teardown - Handles cleanup of worker processes and Firebase connections
module.exports = async () => {
  console.log('🧹 Jest Global Teardown: Starting cleanup...');

  // Set global teardown flag to prevent new Firebase initializations
  global.jestTearingDown = true;

  // Force cleanup of any remaining timers and intervals
  if (typeof global.gc === 'function') {
    global.gc();
  }

  // Clear any remaining timeouts/intervals
  const highestId = setTimeout(() => {}, 0);
  for (let i = 0; i <= highestId; i++) {
    clearTimeout(i);
    clearInterval(i);
  }

  // Force exit any hanging processes after a short delay
  setTimeout(() => {
    console.log('🚪 Jest Global Teardown: Force exiting...');
    process.exit(0);
  }, 1000);

  console.log('✅ Jest Global Teardown: Cleanup completed');
}; 