import { TestResult, TestSetupConfig, QuestionStatus, PreparedTest } from '../types';

const STORAGE_KEYS = {
  TEST_HISTORY: 'jee_dpp_test_history_v1',
  ACTIVE_SESSION: 'jee_dpp_active_session_v1',
  SAVED_TESTS: 'jee_dpp_saved_tests_v1',
  PREPARED_TESTS: 'jee_dpp_prepared_tests_v1',
  PREPARED_TESTS_INITIALIZED: 'jee_dpp_prepared_tests_initialized_v1',
  THEME_PREFERENCE: 'jee_dpp_theme_v1',
};

export interface ActiveSessionData {
  testConfig: TestSetupConfig;
  responses: Record<string, string | string[]>;
  statuses: Record<string, QuestionStatus>;
  timeSpentPerQuestion: Record<string, number>;
  startedAt: number;
  initialDurationMinutes: number;
  remainingSeconds: number;
  lastActiveTimestamp: number;
  currentQuestionIndex: number;
}

export const StorageService = {
  // Test History
  getHistory(): TestResult[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TEST_HISTORY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Failed to load test history:', e);
      return [];
    }
  },

  saveResult(result: TestResult): void {
    try {
      const history = this.getHistory();
      // Prepend so newest is first
      const updated = [result, ...history.filter(h => h.id !== result.id)];
      localStorage.setItem(STORAGE_KEYS.TEST_HISTORY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save test result:', e);
    }
  },

  getResultById(id: string): TestResult | null {
    const history = this.getHistory();
    return history.find(h => h.id === id) || null;
  },

  deleteResult(id: string): void {
    try {
      const history = this.getHistory();
      const updated = history.filter(h => h.id !== id);
      localStorage.setItem(STORAGE_KEYS.TEST_HISTORY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to delete test result:', e);
    }
  },

  clearHistory(): void {
    localStorage.removeItem(STORAGE_KEYS.TEST_HISTORY);
  },

  // Active Session preservation (prevents accidental data loss on refresh/nav)
  saveActiveSession(session: ActiveSessionData): void {
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(session));
    } catch (e) {
      console.error('Failed to save active session:', e);
    }
  },

  getActiveSession(): ActiveSessionData | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Failed to get active session:', e);
      return null;
    }
  },

  clearActiveSession(): void {
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
  },

  // Saved tests / DPPs
  getSavedTests(): TestSetupConfig[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SAVED_TESTS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  saveTestConfig(config: TestSetupConfig): void {
    try {
      const tests = this.getSavedTests();
      const updated = [config, ...tests.filter(t => t.testId !== config.testId)];
      localStorage.setItem(STORAGE_KEYS.SAVED_TESTS, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save test config:', e);
    }
  },

  deleteTestConfig(testId: string): void {
    try {
      const tests = this.getSavedTests();
      const updated = tests.filter(t => t.testId !== testId);
      localStorage.setItem(STORAGE_KEYS.SAVED_TESTS, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to delete test config:', e);
    }
  },

  // Prepared Tests / Test Library (permanently stored so no re-processing is needed)
  getPreparedTests(): PreparedTest[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PREPARED_TESTS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Failed to load prepared tests:', e);
      return [];
    }
  },

  savePreparedTest(test: PreparedTest): void {
    try {
      const current = this.getPreparedTests();
      const updated = [test, ...current.filter(t => t.id !== test.id)];
      localStorage.setItem(STORAGE_KEYS.PREPARED_TESTS, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save prepared test:', e);
    }
  },

  updatePreparedTestTitle(id: string, newTitle: string): void {
    try {
      const current = this.getPreparedTests();
      const updated = current.map(t => (t.id === id ? { ...t, testTitle: newTitle.trim(), lastUpdated: new Date().toISOString() } : t));
      localStorage.setItem(STORAGE_KEYS.PREPARED_TESTS, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to update prepared test title:', e);
    }
  },

  isPreparedTestsInitialized(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEYS.PREPARED_TESTS_INITIALIZED) === 'true';
    } catch {
      return false;
    }
  },

  markPreparedTestsInitialized(): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PREPARED_TESTS_INITIALIZED, 'true');
    } catch (e) {
      console.error('Failed to mark prepared tests initialized:', e);
    }
  },

  deletePreparedTest(id: string): void {
    try {
      const current = this.getPreparedTests();
      const updated = current.filter(t => t.id !== id);
      localStorage.setItem(STORAGE_KEYS.PREPARED_TESTS, JSON.stringify(updated));

      // Clean up any test configs associated with this test
      this.deleteTestConfig(id);
      try {
        const savedTests = this.getSavedTests();
        const filteredConfigs = savedTests.filter(
          t => t.testId !== id && !t.testId.includes(id)
        );
        localStorage.setItem(STORAGE_KEYS.SAVED_TESTS, JSON.stringify(filteredConfigs));
      } catch (err) {
        console.error('Error cleaning up associated saved configs:', err);
      }

      // Clean up active session if it belonged to this deleted test
      try {
        const active = this.getActiveSession();
        if (
          active &&
          (active.testConfig?.testId === id || active.testConfig?.testId.includes(id))
        ) {
          this.clearActiveSession();
        }
      } catch (err) {
        console.error('Error cleaning up associated active session:', err);
      }
    } catch (e) {
      console.error('Failed to delete prepared test:', e);
    }
  },

  getPreparedTestById(id: string): PreparedTest | null {
    const current = this.getPreparedTests();
    return current.find(t => t.id === id) || null;
  },

  // Theme
  getTheme(): 'light' | 'dark' {
    return (localStorage.getItem(STORAGE_KEYS.THEME_PREFERENCE) as 'light' | 'dark') || 'light';
  },

  setTheme(theme: 'light' | 'dark'): void {
    localStorage.setItem(STORAGE_KEYS.THEME_PREFERENCE, theme);
  },
};
