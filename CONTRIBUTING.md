# Contributing to ESIcodeHub

Thank you for contributing to ESIcodeHub! This guide will help you understand our development workflow.

## 📋 Table of Contents

- [Development Workflow](#development-workflow)
- [Branch Naming Convention](#branch-naming-convention)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Pull Request Process](#pull-request-process)
- [Code Style Guidelines](#code-style-guidelines)
- [Testing Requirements](#testing-requirements)

## 🔄 Development Workflow

We use **Git Flow** with some modifications for our team structure.

### Branch Structure
```
main (production-ready code)
  │
  └── dev (integration branch)
        │
        ├── backend/feature-name
        ├── frontend/feature-name
        └── docs/update-name
```

### Workflow Steps

1. **Always start from `dev`**
```bash
   git switch dev
   git pull origin dev
```

2. **Create your feature branch**
```bash
   git switch -c backend/auth-system
   # or
   git switch -c frontend/submission-form
```

3. **Work on your feature**
```bash
   # Make changes
   git add .
   git commit -m "feat(auth): add JWT authentication"
```

4. **Keep your branch updated**
```bash
   git checkout dev
   git pull origin dev
   git checkout backend/auth-system
   git rebase dev
```

5. **Push your branch**
```bash
   git push origin backend/auth-system
```

6. **Create Pull Request** (on GitHub)

7. **Get review and merge**

## 🌿 Branch Naming Convention

### Format
```
<category>/<short-description>
```

### Categories

| Category     | Usage                     | Examples                      |
|--------------|---------------------------|-------------------------------|
| `backend/`   | Backend features          | `backend/plagiarism-detector` |
| `frontend/`  | Frontend features         | `frontend/code-editor`        |
| `feature/`   | Full-stack features       | `feature/review-system`       |
| `bugfix/`    | Bug fixes                 | `bugfix/login-redirect`       |
| `hotfix/`    | Critical production fixes | `hotfix/database-connection`  |
| `docs/`      | Documentation only        | `docs/api-endpoints`          |
| `refactor/`  | Code refactoring          | `refactor/submission-service` |
| `test/`      | Adding tests              | `test/plagiarism-unit-tests`  |

### Examples

✅ **Good:**
- `backend/user-registration`
- `frontend/dashboard-layout`
- `bugfix/submission-upload-error`
- `docs/architecture-diagram`

❌ **Bad:**
- `my-feature` (no category)
- `backend/fixing_stuff` (use kebab-case, not snake_case)
- `BACKEND/AUTH` (use lowercase)
- `backend/this-is-a-very-long-branch-name-that-describes-everything` (too long)

## 💬 Commit Message Guidelines

We follow the **Conventional Commits** specification.

### Format
```
<type>(<scope>): <subject>

<body> (optional)

<footer> (optional)
```

### Types

| Type       | Usage                                            |
|------------|--------------------------------------------------|
| `feat`     | New feature                                      |
| `fix`      | Bug fix                                          |
| `docs`     | Documentation changes                            |
| `style`    | Code style changes (formatting, no logic change) |
| `refactor` | Code refactoring                                 |
| `test`     | Adding or updating tests                         |
| `chore`    | Maintenance tasks                                |
| `perf`     | Performance improvements                         |

### Examples

✅ **Good:**
```bash
feat(auth): add JWT token refresh endpoint

Implement token refresh mechanism using djangorestframework-simplejwt.
Tokens expire after 1 hour and can be refreshed for up to 7 days.

Closes #15
```
```bash
fix(plagiarism): correct AST comparison algorithm

The previous algorithm was not handling nested functions correctly.
Updated to traverse the entire AST tree recursively.
```
```bash
docs(readme): update installation instructions
```

❌ **Bad:**
```bash
"fixed bug"
"updated files"
"changes"
"asdfasdf"
```

### Subject Line Rules

- Use imperative mood: "add feature" not "added feature"
- Don't capitalize first letter
- No period at the end
- Limit to 50 characters
- Be specific but concise

### Body Rules (if needed)

- Wrap at 72 characters
- Explain **what** and **why**, not **how**
- Reference issues: `Closes #123`, `Fixes #456`

## 🔃 Pull Request Process

### Before Creating PR

1. **Ensure your code works**
```bash
   # Backend
   python manage.py test
   
   # Frontend
   npm run build
   npm test
```

2. **Update documentation** if needed

3. **Rebase on latest `dev`**
```bash
   git checkout develop
   git pull origin develop
   git checkout your-branch
   git rebase develop
```

### Creating the PR

1. Go to GitHub → Pull Requests → New Pull Request
2. Base: `dev` ← Compare: `your-branch`
3. Fill out the PR template (see below)
4. Assign reviewers:
   - Backend PRs: Assign team lead
   - Frontend PRs: Assign frontend lead
5. Link related issues

### PR Title Format
```
[Category] Brief description
```

Examples:
- `[Backend] Add plagiarism detection API`
- `[Frontend] Implement code editor component`
- `[Bugfix] Fix submission upload validation`

### PR Template
```markdown
## 📝 Description

Brief description of what this PR does.

## 🎯 Type of Change

- [ ] New feature
- [ ] Bug fix
- [ ] Documentation update
- [ ] Refactoring
- [ ] Other (please describe)

## ✅ Checklist

- [ ] My code follows the project's style guidelines
- [ ] I have performed a self-review
- [ ] I have commented my code where necessary
- [ ] I have updated the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix/feature works
- [ ] New and existing unit tests pass locally
- [ ] Any dependent changes have been merged

## 🧪 Testing

Describe how you tested this:
- [ ] Manual testing
- [ ] Unit tests
- [ ] Integration tests

## 📸 Screenshots (if applicable)

Add screenshots or GIFs for UI changes.

## 🔗 Related Issues

Closes #issue_number
```

### Review Process

1. **At least 1 approval required**
2. **All checks must pass** (CI/CD if set up)
3. **Resolve all conversations**
4. **Squash and merge** or **Rebase and merge** (team decision)

### After Merge

1. Delete your feature branch
2. Pull latest `dev`
3. Start new feature from updated `dev`

## 🎨 Code Style Guidelines

### Python (Backend)

Follow **PEP 8** with these additions:
```python
# Use 4 spaces for indentation
# Line length: 100 characters (not 79)
# Use docstrings for all functions and classes

class PlagiarismDetector:
    """
    Detects code similarity using AST comparison.
    
    Attributes:
        threshold (float): Minimum similarity percentage to flag
    """
    
    def __init__(self, threshold: float = 70.0):
        self.threshold = threshold
    
    def detect(self, code1: str, code2: str) -> dict:
        """
        Compare two code snippets for similarity.
        
        Args:
            code1: First code snippet
            code2: Second code snippet
        
        Returns:
            Dictionary with similarity score and matches
        """
        pass
```

**Tools:**
- **Formatter**: `black`
- **Linter**: `flake8` or `ruff`
- **Type checker**: `mypy` (optional but recommended)
```bash
# Format code
black .

# Check style
flake8 .

# Check types
mypy .
```

### TypeScript/React (Frontend)

Follow **Airbnb Style Guide** with these additions:
```typescript
// Use 2 spaces for indentation
// Line length: 100 characters
// Use TypeScript types, avoid 'any'

interface SubmissionProps {
  id: number;
  title: string;
  code: string;
  onSubmit: (data: SubmissionData) => Promise<void>;
}

export default function SubmissionForm({ 
  id, 
  title, 
  code, 
  onSubmit 
}: SubmissionProps) {
  const [loading, setLoading] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({ id, title, code });
    } catch (error) {
      console.error('Submission failed:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      {/* JSX here */}
    </form>
  );
}
```

**Tools:**
- **Formatter**: `prettier`
- **Linter**: `eslint`
```bash
# Format code
npm run format

# Check style
npm run lint
```

### General Rules

1. **Write meaningful variable names**
   - ✅ `user_email`, `plagiarism_score`
   - ❌ `x`, `temp`, `data1`

2. **Keep functions small** (< 50 lines)

3. **Don't repeat yourself (DRY)**

4. **Comment complex logic**, not obvious code
```python
   # ❌ Bad
   user = User.objects.get(id=user_id)  # Get user
   
   # ✅ Good
   # Fetch user and prefetch related submissions for efficiency
   user = User.objects.prefetch_related('submissions').get(id=user_id)
```

5. **Use consistent naming**
   - Python: `snake_case` for functions/variables, `PascalCase` for classes
   - TypeScript: `camelCase` for functions/variables, `PascalCase` for components

## 🧪 Testing Requirements

### Backend Tests

All new features must include tests.
```python
# apps/submissions/tests.py
from django.test import TestCase
from apps.submissions.models import CodeSubmission

class SubmissionModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='test@esi.dz',
            password='testpass123'
        )
    
    def test_create_submission(self):
        submission = CodeSubmission.objects.create(
            user=self.user,
            title='Test Submission',
            code='print("hello")',
            language='python'
        )
        self.assertEqual(submission.title, 'Test Submission')
```

Run tests:
```bash
cd backend
python manage.py test
```

### Frontend Tests

Use React Testing Library for component tests.
```typescript
// components/SubmissionForm.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import SubmissionForm from './SubmissionForm';

describe('SubmissionForm', () => {
  it('renders form fields', () => {
    render(<SubmissionForm />);
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/code/i)).toBeInTheDocument();
  });
  
  it('submits form data', async () => {
    const handleSubmit = jest.fn();
    render(<SubmissionForm onSubmit={handleSubmit} />);
    
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: 'Test Title' }
    });
    
    fireEvent.click(screen.getByText(/submit/i));
    
    expect(handleSubmit).toHaveBeenCalled();
  });
});
```

Run tests:
```bash
cd frontend
npm test
```

## ❓ Questions?

If you have questions:
1. Check existing documentation in `/docs`
2. Ask in team Discord/Slack channel
3. Tag `@team-leads` for urgent issues

## 🎉 Thank You!

Your contributions make this project better. Happy coding! 🚀
