Write-Host "Creating new tables (departments, batch_years, lecturers) in spsm_db..." -ForegroundColor Cyan

# 0. Add avatar_url to users table
Write-Host "Adding avatar_url to 'users' table..." -ForegroundColor Yellow
appwrite databases create-string-attribute --database-id spsm_db --collection-id users --key avatar_url --size 1000 --required false

# 1. Collection 'departments'
Write-Host "Creating collection 'departments'..." -ForegroundColor Yellow
appwrite databases create-collection --database-id spsm_db --collection-id departments --name "Departments" --permissions 'read(\"any\")' 'create(\"any\")' 'update(\"any\")' 'delete(\"any\")'
appwrite databases create-string-attribute --database-id spsm_db --collection-id departments --key name --size 255 --required true
appwrite databases create-string-attribute --database-id spsm_db --collection-id departments --key code --size 50 --required true
appwrite databases create-string-attribute --database-id spsm_db --collection-id departments --key faculty --size 255 --required false --xdefault "Fakultas Teknik"
appwrite databases create-boolean-attribute --database-id spsm_db --collection-id departments --key is_active --required false --xdefault true

# 2. Collection 'batch_years'
Write-Host "Creating collection 'batch_years'..." -ForegroundColor Yellow
appwrite databases create-collection --database-id spsm_db --collection-id batch_years --name "Batch Years" --permissions 'read(\"any\")' 'create(\"any\")' 'update(\"any\")' 'delete(\"any\")'
appwrite databases create-integer-attribute --database-id spsm_db --collection-id batch_years --key year --required true
appwrite databases create-string-attribute --database-id spsm_db --collection-id batch_years --key label --size 50 --required true
appwrite databases create-boolean-attribute --database-id spsm_db --collection-id batch_years --key is_active --required false --xdefault true

# 3. Collection 'lecturers' (Dosen)
Write-Host "Creating collection 'lecturers'..." -ForegroundColor Yellow
appwrite databases create-collection --database-id spsm_db --collection-id lecturers --name "Lecturers" --permissions 'read(\"any\")' 'create(\"any\")' 'update(\"any\")' 'delete(\"any\")'
appwrite databases create-string-attribute --database-id spsm_db --collection-id lecturers --key user_id --size 255 --required false
appwrite databases create-string-attribute --database-id spsm_db --collection-id lecturers --key nip --size 50 --required true
appwrite databases create-string-attribute --database-id spsm_db --collection-id lecturers --key name --size 255 --required true
appwrite databases create-string-attribute --database-id spsm_db --collection-id lecturers --key email --size 255 --required true
appwrite databases create-string-attribute --database-id spsm_db --collection-id lecturers --key department_id --size 50 --required true
appwrite databases create-string-attribute --database-id spsm_db --collection-id lecturers --key expertise --size 500 --required false
appwrite databases create-integer-attribute --database-id spsm_db --collection-id lecturers --key quota --required false --xdefault 10
appwrite databases create-integer-attribute --database-id spsm_db --collection-id lecturers --key current_students --required false --xdefault 0
appwrite databases create-string-attribute --database-id spsm_db --collection-id lecturers --key role --size 50 --required false --xdefault "lecturer"
appwrite databases create-boolean-attribute --database-id spsm_db --collection-id lecturers --key is_active --required false --xdefault true

Write-Host "Waiting 5 seconds for attributes to be ready before creating indexes..." -ForegroundColor Cyan
Start-Sleep -Seconds 5

# 4. Indexes
Write-Host "Creating indexes..." -ForegroundColor Yellow
appwrite databases create-index --database-id spsm_db --collection-id departments --key idx_dept_code --type key --attributes code
appwrite databases create-index --database-id spsm_db --collection-id batch_years --key idx_batch_year --type key --attributes year
appwrite databases create-index --database-id spsm_db --collection-id lecturers --key idx_lecturer_nip --type key --attributes nip
appwrite databases create-index --database-id spsm_db --collection-id lecturers --key idx_lecturer_dept --type key --attributes department_id
appwrite databases create-index --database-id spsm_db --collection-id lecturers --key idx_lecturer_role --type key --attributes role

Write-Host "All academic and lecturer tables created successfully! 🎉" -ForegroundColor Green
