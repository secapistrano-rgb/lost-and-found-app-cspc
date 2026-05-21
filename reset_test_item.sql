UPDATE items SET status='active' WHERE id='lost-1768403359613-0d4pt5m4u';
UPDATE users SET fake_report_count = GREATEST(0, COALESCE(fake_report_count, 0) - 1) WHERE email='secapistrano@my.cspc.edu.ph';
