// Load backend credentials independently of the working directory.
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
