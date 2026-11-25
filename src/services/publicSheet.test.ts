import { describe, expect, it, vi } from "vitest";
import {
  ASSIGNED_EXAM_ID,
  getAssignedExam,
  getSubjectDisplayName,
  parseRolesFromSheetRows,
  parseUsersFromSheetRows,
  readAllTablesFromSpreadsheet,
  updateUserInSpreadsheet,
  verifyUserSessionActive,
} from "@/services/publicSheet";

describe("getAssignedExam", () => {
  const samplePaper = {
    id: "assigned-demo",
    title: "計算機概論 模擬測驗",
    description: "公職考試 ・ 50 題 ・ 60 分鐘",
    subject: "計算機概論",
    subjectId: "math" as const,
    difficultyLv: 3,
    questionCount: 50,
    totalScore: 100,
    durationMinutes: 60,
    createdAt: "2024-05-20",
    status: "published" as const,
    questionIds: Array.from({ length: 50 }, (_, i) => `assigned-${String(i + 1).padStart(2, '0')}`),
  };

  const sampleQuestions = Array.from({ length: 50 }, (_, i) => ({
    id: `assigned-${String(i + 1).padStart(2, '0')}`,
    subjectId: "math" as const,
    type: "single" as const,
    content: `題目 ${i + 1}`,
    difficulty: "medium" as const,
    points: 2,
    options: ["選項A", "選項B", "選項C", "選項D"],
    correctAnswer: "B",
    explanation: "解析內容",
    tags: ["計算機概論"],
    updatedAt: "2024-05-20",
  }));

  it("returns the assigned exam for the known id", async () => {
    const exam = await getAssignedExam(ASSIGNED_EXAM_ID, [samplePaper], sampleQuestions);
    expect(exam).not.toBeNull();
    expect(exam?.id).toBe("assigned-demo");
    expect(exam?.title).toBe("計算機概論 模擬測驗");
    expect(exam?.subtitle).toBe("公職考試 ・ 50 題 ・ 60 分鐘");
    expect(exam?.durationSec).toBe(3600);
  });

  it("returns null for an unknown id", async () => {
    expect(await getAssignedExam("nope", [samplePaper], sampleQuestions)).toBeNull();
  });

  it("provides 50 single-choice questions worth 2 points each", async () => {
    const exam = await getAssignedExam(ASSIGNED_EXAM_ID, [samplePaper], sampleQuestions);
    expect(exam?.questions).toHaveLength(50);
    for (const question of exam?.questions ?? []) {
      expect(question.type).toBe("single");
      expect(question.points).toBe(2);
      expect(question.options).toHaveLength(4);
      expect(question.options.map((option) => option.id)).toEqual(["A", "B", "C", "D"]);
      expect(question.answer).toBeDefined();
      expect(['A', 'B', 'C', 'D']).toContain(question.answer);
    }
  });

  it("uses unique question ids and a stable prefix", async () => {
    const exam = await getAssignedExam(ASSIGNED_EXAM_ID, [samplePaper], sampleQuestions);
    const ids = exam?.questions.map((question) => question.id) ?? [];
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.startsWith("assigned-"))).toBe(true);
  });

  it("dynamically resolves an exam paper from published exam papers", async () => {
    const mockPaper = {
      id: "EXAM-2024-MATH-081",
      title: "2024年高二數學期末統一測驗",
      description: "高二數學下學期期末考試",
      subject: "數學",
      subjectId: "math" as const,
      difficultyLv: 3,
      questionCount: 1,
      totalScore: 10,
      durationMinutes: 30,
      createdAt: "2024-06-20",
      status: "published" as const,
      questionIds: ["Q-MATH-001"],
    };
    const mockQuestions = [
      {
        id: "Q-MATH-001",
        subjectId: "math" as const,
        type: "single" as const,
        content: "1 + 1 = ?",
        difficulty: "easy" as const,
        points: 10,
        tags: ["基本運算"],
        updatedAt: "2024-06-20",
        options: ["1", "2", "3", "4"],
        correctAnswer: "2",
      },
    ];
    const mathExam = await getAssignedExam("EXAM-2024-MATH-081", [mockPaper], mockQuestions);
    expect(mathExam).not.toBeNull();
    expect(mathExam?.title).toContain("2024年高二數學期末統一測驗");
    expect(mathExam?.questions.length).toBeGreaterThan(0);
  });
});

describe("parseRolesFromSheetRows & parseUsersFromSheetRows", () => {
  it("parses roles and joins users.role with roles.code", () => {
    const roleRows = [
      ["id", "code", "name", "description", "created_at"],
      [1, "ADMIN", "管理員", "最高權限管理員", "2024-01-01 00:00:00"],
      [2, "USER", "用戶", "一般用戶", "2024-01-01 00:00:00"],
      [3, "GUEST", "訪客", "訪客權限", "2024-01-01 00:00:00"],
    ];

    const userRows = [
      [
        "id",
        "uuid",
        "status",
        "role",
        "name",
        "identifier",
        "credential",
        "google_sheet_URL",
        "last_login_at",
        "created_at",
        "updated_at",
      ],
      [
        1,
        "usr_001",
        1,
        "ADMIN",
        "王管理",
        "admin01",
        "pass123",
        "https://docs.google.com/spreadsheets/d/abc/edit",
        "2026-11-10 10:00:00",
        "2026-01-01 00:00:00",
        "2026-11-10 10:00:00",
      ],
      [
        2,
        "usr_002",
        0,
        "USER",
        "李停用",
        "user02",
        "pass456",
        "",
        "",
        "2026-01-01 00:00:00",
        "",
      ],
    ];

    const roles = parseRolesFromSheetRows(roleRows);
    expect(roles).toHaveLength(3);
    expect(roles[0]).toMatchObject({ code: "ADMIN", name: "管理員" });

    const users = parseUsersFromSheetRows(userRows, roles);
    expect(users).toHaveLength(2);
    expect(users[0]).toMatchObject({
      id: 1,
      uuid: "usr_001",
      status: 1,
      role: "ADMIN",
      roleName: "管理員",
      roleDescription: "最高權限管理員",
      name: "王管理",
      identifier: "admin01",
      credential: "pass123",
    });
    expect(users[1]).toMatchObject({
      id: 2,
      uuid: "usr_002",
      status: 0,
      role: "USER",
      roleName: "用戶",
      identifier: "user02",
    });
  });

  it("updates user profile including google_sheet_URL via updateUserInSpreadsheet", async () => {
    const userToUpdate = {
      id: 1,
      uuid: "usr_001",
      status: 1,
      role: "USER",
      name: "測試王",
      nickname: "測試王",
      identifier: "testuser01",
      credential: "hashed_pass",
      google_sheet_URL: "https://docs.google.com/spreadsheets/d/my-personal-sheet-id/edit",
      created_at: "2026-01-01 00:00:00",
      updated_at: "2026-11-17 12:00:00",
    };

    // Mock fetch for REST API fallback flow
    const originalFetch = global.fetch;
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("/api/sheet")) {
        return {
          ok: true,
          json: async () => ({ success: true }),
        };
      }
      return {
        ok: true,
        json: async () => ({ values: [] }),
      };
    });
    global.fetch = fetchMock;

    try {
      const res = await updateUserInSpreadsheet(null, "test_sheet_id", userToUpdate);
      expect(res.success).toBe(true);
      expect(fetchMock).toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
    }
  });

  describe("getSubjectDisplayName", () => {
    const mockCategories = [
      { id: 101, categories_name: "進階微積分", parent_id: 0, level: 1, sort_order: 1 },
    ];

    it("returns '未分類' for empty or nullish inputs", () => {
      expect(getSubjectDisplayName(null)).toBe("未分類");
      expect(getSubjectDisplayName("   ")).toBe("未分類");
      expect(getSubjectDisplayName(undefined)).toBe("未分類");
    });

    it("resolves name from categories list by id or name", () => {
      expect(getSubjectDisplayName("101", mockCategories)).toBe("進階微積分");
      expect(getSubjectDisplayName("進階微積分", mockCategories)).toBe("進階微積分");
    });

    it("resolves standard builtin subjects", () => {
      expect(getSubjectDisplayName("math")).toBe("數學");
      expect(getSubjectDisplayName("chinese")).toBe("國文");
      expect(getSubjectDisplayName("physics")).toBe("物理");
      expect(getSubjectDisplayName("history")).toBe("歷史");
    });

    it("preserves custom subject name if not in categories or builtins", () => {
      expect(getSubjectDisplayName("機器學習")).toBe("機器學習");
    });
  });

  describe("readAllTablesFromSpreadsheet & verifyUserSessionActive", () => {
    it("reads and parses all spreadsheet tables using batchGet", async () => {
      const originalFetch = global.fetch;

      const mockMetaResponse = {
        properties: { title: "測試資料庫" },
        sheets: [
          { properties: { title: "categories" } },
          { properties: { title: "test_bank" } },
          { properties: { title: "quiz_bank_publish" } },
          { properties: { title: "roles" } },
          { properties: { title: "users" } },
        ],
      };

      const mockBatchGetResponse = {
        valueRanges: [
          {
            range: "categories!A1:Z500",
            values: [
              ["id", "categories_name", "parent_id", "level", "sort_order"],
              [1, "數學類", 0, 1, 1],
            ],
          },
          {
            range: "test_bank!A1:Z500",
            values: [
              ["id", "test_id", "question", "option", "answer", "explanation", "difficulty", "score", "category_id", "tags"],
              [1, "Q-01", "1+1=?", '["1", "2"]', "B", "基礎加法", "easy", 10, 1, "數學"],
            ],
          },
          {
            range: "quiz_bank_publish!A1:Z500",
            values: [
              ["id", "quiz_id", "quiz_name", "categories", "difficulty", "number", "score", "time", "update_time", "test_id"],
              [1, "EX-01", "基礎考卷", "數學", 3, 1, 10, 30, "2026-11-25", "Q-01"],
            ],
          },
          {
            range: "roles!A1:Z500",
            values: [
              ["id", "code", "name"],
              [1, "ADMIN", "管理員"],
            ],
          },
          {
            range: "users!A1:Z500",
            values: [
              ["id", "uuid", "status", "role", "name", "identifier"],
              [1, "u-01", 1, "ADMIN", "張管理", "admin"],
            ],
          },
        ],
      };

      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("includeGridData=false")) {
          return { ok: true, json: async () => mockMetaResponse };
        }
        return { ok: true, json: async () => mockBatchGetResponse };
      });

      try {
        const result = await readAllTablesFromSpreadsheet("token", "sheet-id");
        expect(result.spreadsheetTitle).toBe("測試資料庫");
        expect(result.categories).toHaveLength(1);
        expect(result.categories[0].categories_name).toBe("數學類");
        expect(result.questions).toHaveLength(1);
        expect(result.questions[0].id).toBe("Q-01");
        expect(result.publishedExams).toHaveLength(1);
        expect(result.users).toHaveLength(1);
        expect(result.roles).toHaveLength(1);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("verifies user session status correctly", async () => {
      const originalFetch = global.fetch;

      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("sheet=users")) {
          const csvText = [
            'id,uuid,status,role,name,identifier,credential,google_sheet_url,last_login_at,created_at,updated_at,current_session_id',
            '1,u-01,1,USER,正常用戶,user1,,,2026/11/25,2026/01/01,2026/11/25,sess-current',
          ].join('\n');
          return {
            ok: true,
            text: async () => csvText,
            json: async () => ({}),
          };
        }
        if (url.includes("sheet=roles")) {
          const csvText = 'id,code,name,description,created_at\n1,USER,用戶,一般用戶,2026/01/01';
          return {
            ok: true,
            text: async () => csvText,
            json: async () => ({}),
          };
        }
        return {
          ok: true,
          text: async () => '',
          json: async () => ({ values: [] }),
        };
      });

      try {
        // Same session
        const res1 = await verifyUserSessionActive("user1", "sess-current", "sheet-id");
        expect(res1.isValid).toBe(true);

        // Different session (logged in on another device)
        const res2 = await verifyUserSessionActive("user1", "sess-other", "sheet-id");
        expect(res2.isValid).toBe(false);
        expect(res2.reason).toContain("其他裝置登入");

        // Missing arguments
        const res3 = await verifyUserSessionActive("", "");
        expect(res3.isValid).toBe(true);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});
