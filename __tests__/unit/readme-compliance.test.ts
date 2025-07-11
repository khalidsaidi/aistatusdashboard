import fs from 'fs';
import path from 'path';

describe('README Trademark Compliance', () => {
  let readmeContent: string;

  beforeAll(() => {
    const readmePath = path.join(process.cwd(), 'README.md');
    readmeContent = fs.readFileSync(readmePath, 'utf-8');
  });

  it('should have trademark compliance section', () => {
    expect(readmeContent).toMatch(/trademark.*compliance/i);
  });

  it('should have removal clause for rights holders', () => {
    expect(readmeContent).toMatch(/rights holder/i);
    expect(readmeContent).toMatch(/24.*h/i);
  });

  it('should document logo usage guidelines', () => {
    expect(readmeContent).toMatch(/logo.*usage/i);
    expect(readmeContent).toMatch(/official.*files/i);
  });

  it('should mention rate limiting compliance', () => {
    expect(readmeContent).toMatch(/rate.*limit/i);
    expect(readmeContent).toMatch(/robots\.txt/i);
  });
});
