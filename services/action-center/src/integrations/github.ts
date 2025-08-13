import { Octokit } from '@octokit/rest';
import { logger } from '../lib/logger';

interface GitHubFile {
  path: string;
  content: string;
  message: string;
  branch?: string;
}

interface GitHubIssue {
  title: string;
  body: string;
  labels?: string[];
  assignees?: string[];
  milestone?: number;
}

export class GitHub {
  private octokit: Octokit;
  private owner: string;
  private repo: string;

  constructor() {
    const token = process.env.GITHUB_TOKEN || '';
    this.owner = process.env.GITHUB_OWNER || '';
    this.repo = process.env.GITHUB_REPO || '';
    
    if (!token) {
      logger.warn('GitHub token not configured');
    }
    
    this.octokit = new Octokit({
      auth: token
    });
  }

  async createFile(file: GitHubFile): Promise<any> {
    try {
      // Encode content to base64
      const content = Buffer.from(file.content).toString('base64');
      
      const response = await this.octokit.repos.createOrUpdateFileContents({
        owner: this.owner,
        repo: this.repo,
        path: file.path,
        message: file.message,
        content,
        branch: file.branch || 'main'
      });
      
      logger.info(`Created GitHub file: ${file.path}`);
      return {
        path: file.path,
        sha: response.data.content?.sha,
        url: response.data.content?.html_url
      };
      
    } catch (error) {
      logger.error(`Failed to create GitHub file ${file.path}:`, error);
      throw this.handleError(error);
    }
  }

  async updateFile(file: GitHubFile & { sha?: string }): Promise<any> {
    try {
      // Get current file to get SHA if not provided
      let sha = file.sha;
      if (!sha) {
        const current = await this.getFile(file.path, file.branch);
        sha = current.sha;
      }
      
      const content = Buffer.from(file.content).toString('base64');
      
      const response = await this.octokit.repos.createOrUpdateFileContents({
        owner: this.owner,
        repo: this.repo,
        path: file.path,
        message: file.message,
        content,
        sha,
        branch: file.branch || 'main'
      });
      
      logger.info(`Updated GitHub file: ${file.path}`);
      return {
        path: file.path,
        sha: response.data.content?.sha,
        url: response.data.content?.html_url
      };
      
    } catch (error) {
      logger.error(`Failed to update GitHub file ${file.path}:`, error);
      throw this.handleError(error);
    }
  }

  async deleteFile(path: string, message: string, sha: string, branch?: string): Promise<void> {
    try {
      await this.octokit.repos.deleteFile({
        owner: this.owner,
        repo: this.repo,
        path,
        message,
        sha,
        branch: branch || 'main'
      });
      
      logger.info(`Deleted GitHub file: ${path}`);
      
    } catch (error) {
      logger.error(`Failed to delete GitHub file ${path}:`, error);
      throw this.handleError(error);
    }
  }

  async getFile(path: string, branch?: string): Promise<any> {
    try {
      const response = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path,
        ref: branch || 'main'
      });
      
      if (Array.isArray(response.data)) {
        throw new Error(`Path ${path} is a directory, not a file`);
      }
      
      if ('content' in response.data) {
        const content = Buffer.from(response.data.content, 'base64').toString('utf8');
        return {
          path,
          sha: response.data.sha,
          content
        };
      }
      
      throw new Error(`Unable to get content for ${path}`);
      
    } catch (error) {
      logger.error(`Failed to get GitHub file ${path}:`, error);
      throw this.handleError(error);
    }
  }

  async createIssue(issue: GitHubIssue): Promise<any> {
    try {
      const response = await this.octokit.issues.create({
        owner: this.owner,
        repo: this.repo,
        title: issue.title,
        body: issue.body,
        labels: issue.labels,
        assignees: issue.assignees,
        milestone: issue.milestone
      });
      
      logger.info(`Created GitHub issue: #${response.data.number}`);
      return {
        number: response.data.number,
        html_url: response.data.html_url,
        id: response.data.id
      };
      
    } catch (error) {
      logger.error('Failed to create GitHub issue:', error);
      throw this.handleError(error);
    }
  }

  async updateIssue(issueNumber: number, updates: Partial<GitHubIssue>): Promise<any> {
    try {
      const response = await this.octokit.issues.update({
        owner: this.owner,
        repo: this.repo,
        issue_number: issueNumber,
        ...updates
      });
      
      logger.info(`Updated GitHub issue: #${issueNumber}`);
      return response.data;
      
    } catch (error) {
      logger.error(`Failed to update GitHub issue #${issueNumber}:`, error);
      throw this.handleError(error);
    }
  }

  async closeIssue(issueNumber: number): Promise<void> {
    try {
      await this.octokit.issues.update({
        owner: this.owner,
        repo: this.repo,
        issue_number: issueNumber,
        state: 'closed'
      });
      
      logger.info(`Closed GitHub issue: #${issueNumber}`);
      
    } catch (error) {
      logger.error(`Failed to close GitHub issue #${issueNumber}:`, error);
      throw this.handleError(error);
    }
  }

  async createPullRequest(params: {
    title: string;
    body: string;
    head: string;
    base?: string;
  }): Promise<any> {
    try {
      const response = await this.octokit.pulls.create({
        owner: this.owner,
        repo: this.repo,
        title: params.title,
        body: params.body,
        head: params.head,
        base: params.base || 'main'
      });
      
      logger.info(`Created GitHub PR: #${response.data.number}`);
      return {
        number: response.data.number,
        html_url: response.data.html_url,
        id: response.data.id
      };
      
    } catch (error) {
      logger.error('Failed to create GitHub PR:', error);
      throw this.handleError(error);
    }
  }

  async createBranch(branchName: string, baseBranch: string = 'main'): Promise<void> {
    try {
      // Get the SHA of the base branch
      const { data: baseRef } = await this.octokit.git.getRef({
        owner: this.owner,
        repo: this.repo,
        ref: `heads/${baseBranch}`
      });
      
      // Create new branch
      await this.octokit.git.createRef({
        owner: this.owner,
        repo: this.repo,
        ref: `refs/heads/${branchName}`,
        sha: baseRef.object.sha
      });
      
      logger.info(`Created GitHub branch: ${branchName}`);
      
    } catch (error) {
      // Branch might already exist
      if ((error as any).status === 422) {
        logger.info(`GitHub branch already exists: ${branchName}`);
      } else {
        logger.error(`Failed to create GitHub branch ${branchName}:`, error);
        throw this.handleError(error);
      }
    }
  }

  async rollback(rollbackData: any): Promise<void> {
    if (rollbackData.path && rollbackData.sha) {
      // Delete the file
      await this.deleteFile(
        rollbackData.path,
        `Rollback: Remove ${rollbackData.path}`,
        rollbackData.sha
      );
    }
    
    if (rollbackData.issueNumber) {
      // Close the issue
      await this.closeIssue(rollbackData.issueNumber);
    }
  }

  private handleError(error: any): Error {
    if (error.status === 401) {
      return new Error('GitHub authentication failed');
    }
    
    if (error.status === 403) {
      return new Error('GitHub permission denied');
    }
    
    if (error.status === 404) {
      return new Error('GitHub resource not found');
    }
    
    if (error.status === 422) {
      return new Error(`GitHub validation error: ${error.message}`);
    }
    
    return new Error(`GitHub API error: ${error.message || error}`);
  }
}