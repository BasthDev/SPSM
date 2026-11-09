Write-Host "Creating collections and attributes in spsm_db..." -ForegroundColor Cyan

# 1. Attributes for 'users'
Write-Host "Creating attributes for 'users'..." -ForegroundColor Yellow
appwrite databases create-string-attribute --database-id spsm_db --collection-id users --key user_id --size 255 --required true
appwrite databases create-string-attribute --database-id spsm_db --collection-id users --key name --size 255 --required true
appwrite databases create-string-attribute --database-id spsm_db --collection-id users --key email --size 255 --required true
appwrite databases create-string-attribute --database-id spsm_db --collection-id users --key role --size 50 --required false --xdefault "student"
appwrite databases create-string-attribute --database-id spsm_db --collection-id users --key nim_or_nip --size 50 --required true
appwrite databases create-string-attribute --database-id spsm_db --collection-id users --key department --size 100 --required true
appwrite databases create-integer-attribute --database-id spsm_db --collection-id users --key batch_year --required true
appwrite databases create-string-attribute --database-id spsm_db --collection-id users --key created_at --size 100 --required false

# 2. Collection 'thesis_submissions'
Write-Host "Creating collection 'thesis_submissions'..." -ForegroundColor Yellow
appwrite databases create-collection --database-id spsm_db --collection-id thesis_submissions --name "Thesis Submissions" --permissions 'read(\"any\")' 'create(\"any\")' 'update(\"any\")' 'delete(\"any\")'
appwrite databases create-string-attribute --database-id spsm_db --collection-id thesis_submissions --key student_id --size 255 --required true
appwrite databases create-string-attribute --database-id spsm_db --collection-id thesis_submissions --key advisor_id --size 255 --required false
appwrite databases create-string-attribute --database-id spsm_db --collection-id thesis_submissions --key status --size 50 --required false --xdefault "pending_lecturer"
appwrite databases create-string-attribute --database-id spsm_db --collection-id thesis_submissions --key submitted_at --size 100 --required true

# 3. Collection 'submission_options'
Write-Host "Creating collection 'submission_options'..." -ForegroundColor Yellow
appwrite databases create-collection --database-id spsm_db --collection-id submission_options --name "Submission Options" --permissions 'read(\"any\")' 'create(\"any\")' 'update(\"any\")' 'delete(\"any\")'
appwrite databases create-string-attribute --database-id spsm_db --collection-id submission_options --key submission_id --size 255 --required true
appwrite databases create-integer-attribute --database-id spsm_db --collection-id submission_options --key option_number --required true
appwrite databases create-string-attribute --database-id spsm_db --collection-id submission_options --key title --size 1000 --required true
appwrite databases create-string-attribute --database-id spsm_db --collection-id submission_options --key background --size 5000 --required true
appwrite databases create-string-attribute --database-id spsm_db --collection-id submission_options --key journal_title --size 1000 --required false
appwrite databases create-string-attribute --database-id spsm_db --collection-id submission_options --key journal_author --size 255 --required false
appwrite databases create-string-attribute --database-id spsm_db --collection-id submission_options --key journal_file_id --size 255 --required false
appwrite databases create-boolean-attribute --database-id spsm_db --collection-id submission_options --key is_selected_by_lecturer --required false --xdefault false

# 4. Collection 'approval_logs'
Write-Host "Creating collection 'approval_logs'..." -ForegroundColor Yellow
appwrite databases create-collection --database-id spsm_db --collection-id approval_logs --name "Approval Logs" --permissions 'read(\"any\")' 'create(\"any\")' 'update(\"any\")' 'delete(\"any\")'
appwrite databases create-string-attribute --database-id spsm_db --collection-id approval_logs --key submission_id --size 255 --required true
appwrite databases create-string-attribute --database-id spsm_db --collection-id approval_logs --key actor_id --size 255 --required true
appwrite databases create-string-attribute --database-id spsm_db --collection-id approval_logs --key action --size 100 --required true
appwrite databases create-string-attribute --database-id spsm_db --collection-id approval_logs --key notes --size 2000 --required false
appwrite databases create-string-attribute --database-id spsm_db --collection-id approval_logs --key created_at --size 100 --required true

Write-Host "Waiting 5 seconds for attributes to be ready before creating indexes..." -ForegroundColor Cyan
Start-Sleep -Seconds 5

# 5. Indexes
Write-Host "Creating indexes..." -ForegroundColor Yellow
appwrite databases create-index --database-id spsm_db --collection-id users --key idx_user_id --type key --attributes user_id
appwrite databases create-index --database-id spsm_db --collection-id thesis_submissions --key idx_student_id --type key --attributes student_id
appwrite databases create-index --database-id spsm_db --collection-id thesis_submissions --key idx_status --type key --attributes status
appwrite databases create-index --database-id spsm_db --collection-id submission_options --key idx_submission_id --type key --attributes submission_id
appwrite databases create-index --database-id spsm_db --collection-id approval_logs --key idx_log_submission_id --type key --attributes submission_id

Write-Host "All tables, attributes, and indexes created successfully! 🎉" -ForegroundColor Green
