const express = require("express");
const router = express.Router();
require("dotenv").config();
const sql = require("mssql");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const mime = require("mime-types"); 
const { uploadToCopBlob } = require("./blobHelper");
router.get("/checklistDocuments", async (req, res) => {
  try {
    const pool = req.app.locals.db;

    const accessType = Number(req.query.accessType); 
    const orgid = parseInt(req.query.orgid);
    const orgdiv = parseInt(req.query.orgdiv || req.query.orgDiv);
    const recruiterid = parseInt(req.query.recruiterid);

    const request = pool
      .request()
      .input("accessType", sql.Int, isNaN(accessType) ? null : accessType)
      .input("orgid", sql.Int, isNaN(orgid) ? null : orgid)
      .input("orgdiv", sql.Int, isNaN(orgdiv) ? null : orgdiv)
      .input("recruiterid", sql.Int, isNaN(recruiterid) ? null : recruiterid);

    const sqlText = `
SELECT
    u.Source,
    u.Id,
    u.DocsName,
    u.Type,
    u.OrgID,
    u.OrgDiv,
    u.RecruiterID
FROM (
    ----------------------------------------------------------------
    -- Base docs
    ----------------------------------------------------------------
    SELECT 
        'base' AS Source,
        od.Id AS Id,
        od.DocsName AS DocsName,
        CAST('Base' AS NVARCHAR(50)) AS Type,
        NULL AS OrgID,
        NULL AS OrgDiv,
        NULL AS RecruiterID,
        0 AS SortKey
    FROM OnBoardingDocList od

    UNION ALL

    ----------------------------------------------------------------
    -- Additional docs
    ----------------------------------------------------------------
    SELECT
        'additional' AS Source,
        ac.AddChecklistId AS Id,
        ac.DocsName AS DocsName,
        CAST('Custom' AS NVARCHAR(50)) AS Type,
        ac.OrgID,
        ac.OrgDiv,
        ac.RecruiterID,
        1 AS SortKey
    FROM AdditionalChecklist ac
    WHERE
        (@accessType = 1 AND ac.OrgID = @orgid)
        OR (@accessType = 2 AND ac.OrgID = @orgid AND ac.OrgDiv = @orgdiv)
        OR (@accessType = 3 AND ac.RecruiterID = @recruiterid)

    UNION ALL

    ----------------------------------------------------------------
    -- AI Items
    ----------------------------------------------------------------
 SELECT
    'AI' AS Source,
    CI.ItemId AS Id,
    CI.Name AS DocsName,
    CAST('AI' AS NVARCHAR(50)) AS Type,
    AP.OrgID,
    AP.OrgDiv,
    AP.RecruiterID,
    2 AS SortKey
FROM AIChecklistLable CI
LEFT JOIN AiChecklist AP ON CI.TemplateId = AP.TemplateId
WHERE
    (@accessType = 1 AND AP.OrgID = @orgid)
    OR (@accessType = 2 AND AP.OrgID = @orgid AND AP.OrgDiv = @orgdiv)
    OR (@accessType = 3 AND AP.RecruiterID = @recruiterid)
) AS u



    `;

    const result = await request.query(sqlText);
    res.status(200).json({ success: true, data: result.recordset || [] });
  } catch (error) {
    console.error("checklistDocuments error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/corporate_type", async (req, res) => {
  try {
    const pool = req.app.locals.db;
    const request = pool.request();

    const sqlText = `SELECT * From corporate_type;`;

    const result = await request.query(sqlText);
    res.status(200).json({ success: true, data: result.recordset || [] });
  } catch (error) {
    console.error("corporate_type error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});


router.post("/createDocuments", async (req, res) => {
  try {
    const pool = req.app.locals.db;
    const { documents, orgid, orgdiv, recruiterid } = req.body;

    if (!documents || !Array.isArray(documents)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid checklist data" });
    }

    const tx = new sql.Transaction(pool);
    await tx.begin();

    const checklistIds = [];

    try {
      for (const item of documents) {
        const checklistName = item.checklistName;
        const createdBy = item.DocsCreatedBy || "system";
        const createdAt = item.createdAt
          ? new Date(item.createdAt)
          : new Date();

        const baseIds = Array.isArray(item.baseIds)
          ? item.baseIds.map(Number)
          : Array.isArray(item.id)
          ? item.id.map(Number)
          : []; 

        const additionalIds = Array.isArray(item.additionalIds)
          ? item.additionalIds.map(Number)
          : [];

        const AIID = Array.isArray(item.AIID) ? item.AIID.map(Number) : [];

        const checklistJSON = JSON.stringify(baseIds);
        const additionalJSON = JSON.stringify(additionalIds);
        const AIIDJSON = JSON.stringify(AIID);

        const result = await tx
          .request()
          .input("ChecklistName", sql.VarChar, checklistName)
          .input("Checklist", sql.NVarChar(sql.MAX), checklistJSON) 
          .input("CreateBy", sql.VarChar, createdBy)
          .input("AdditionalChecklist", sql.NVarChar(sql.MAX), additionalJSON) 
          .input("AIChecklist", sql.NVarChar(sql.MAX), AIIDJSON)
          .input("RecruiterID", sql.Int, parseInt(recruiterid))
          .input("OrgID", sql.Int, parseInt(orgid))
          .input("OrgDiv", sql.Int, parseInt(orgdiv))
          .input("CreatedAt", sql.DateTime, createdAt).query(`
            INSERT INTO CreatedChecklist
              (ChecklistName, Checklist, AdditionalChecklist, CreateBy, CreatedAt, RecruiterID, OrgID, OrgDiv, AIChecklist, Active)
            OUTPUT INSERTED.ChecklistID
            VALUES
              (@ChecklistName, @Checklist, @AdditionalChecklist, @CreateBy, @CreatedAt, @RecruiterID, @OrgID, @OrgDiv, @AIChecklist, 1)
          `);

        checklistIds.push(result.recordset[0].ChecklistID);
      }

      await tx.commit();
      return res
        .status(201)
        .json({
          success: true,
          message: "Checklists created successfully",
          data: checklistIds,
        });
    } catch (err) {
      await tx.rollback();
      return res.status(500).json({ success: false, message: err.message });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/checklistdetails", async (req, res) => {
  try {
    const pool = req.app.locals.db;
    const accessType = Number(req.query.accessType);
    const orgid = req.query.orgid;
    const orgdiv = req.query.orgdiv || req.query.orgDiv;
    const recruiterid = req.query.recruiterid;

  
    if (![1, 2, 3].includes(accessType)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid access type" });
    }

    let query = "";
    let params = [];

    switch (accessType) {
      case 1:
        query = `
          SELECT * 
          FROM CreatedChecklist 
          WHERE active = 1 
          AND orgid = @orgid 
          ORDER BY createdAt DESC
        `;
        params = [{ name: "orgid", type: sql.Int, value: orgid }];
        break;

      case 2:
        query = `
          SELECT * 
          FROM CreatedChecklist 
          WHERE active = 1 
          AND orgid = @orgid 
          AND orgdiv = @orgdiv 
          ORDER BY createdAt DESC
        `;
        params = [
          { name: "orgid", type: sql.Int, value: orgid },
          { name: "orgdiv", type: sql.Int, value: orgdiv },
        ];
        break;

      case 3:
        query = `
          SELECT * 
          FROM CreatedChecklist 
          WHERE active = 1   
          AND recruiterid = @recruiterid
          ORDER BY createdAt DESC
        `;
        params = [
          { name: "orgid", type: sql.Int, value: orgid },
          { name: "orgdiv", type: sql.Int, value: orgdiv },
          { name: "recruiterid", type: sql.Int, value: recruiterid },
        ];
        break;
    }

    const request = pool.request();
    params.forEach((param) =>
      request.input(param.name, param.type, param.value)
    );



    const result = await request.query(query);

    if (!result.recordset.length) {
      return res
        .status(200)
        .json({ success: true, data: [], message: "No checklists found" });
    }

    res.status(200).json({ success: true, data: result.recordset });
  } catch (error) {
    console.error("Checklistdetails error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/AdditionaldocumentCreate", async (req, res) => {
  try {
    const pool = req.app.locals.db;
    const { fullName, orgdiv, orgid, recruiterid, createdAt } = req.body;


    if (!fullName) {
      return res.status(400).json({ error: "Missing document name" });
    }

    const result = await pool
      .request()
      .input("DocsName", sql.NVarChar, fullName)
      .input("OrgDiv", sql.Int, parseInt(orgdiv))
      .input("OrgID", sql.Int, parseInt(orgid))
      .input("RecruiterID", sql.Int, parseInt(recruiterid))
      .input(
        "CreatedAt",
        sql.DateTime,
        createdAt ? new Date(createdAt) : new Date()
      ).query(`
        INSERT INTO AdditionalChecklist (DocsName, OrgDiv, OrgID, RecruiterID, CreatedAt)
        VALUES (@DocsName, @OrgDiv, @OrgID, @RecruiterID, @CreatedAt)
      `);

    res.status(201).json({
      success: true,
      message: "Document created successfully",
      data: result.rowsAffected,
    });
  } catch (err) {
    console.error("Error in documentCreate:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put("/update", async (req, res) => {
  try {
    const pool = req.app.locals.db;

    const {
      checklistId,
      checklistName,
      documents, 
      additionalIds,
      AIID, 
      DocsUpdatedBy,
      updatedAt,
      orgid,
      orgdiv,
    } = req.body;

    if (!checklistId || !checklistName || !Array.isArray(documents)) {
      return res.status(400).json({
        success: false,
        message: "ChecklistID, checklist name, and documents are required",
      });
    }

    const checklistJSON = JSON.stringify(documents.map(Number));
    const additionalJSON = JSON.stringify((additionalIds ?? []).map(Number));
    const AiJSON = JSON.stringify((AIID ?? []).map(Number));

    const result = await pool
      .request()
      .input("ChecklistID", sql.Int, Number(checklistId))
      .input("ChecklistName", sql.VarChar, checklistName)
      .input("Checklist", sql.NVarChar(sql.MAX), checklistJSON)
      .input("AdditionalChecklist", sql.NVarChar(sql.MAX), additionalJSON)
      .input("AIChecklist", sql.NVarChar(sql.MAX), AiJSON)
      .input("lastupdatedby", sql.VarChar, String(DocsUpdatedBy))
      .input("OrgID", sql.Int, isNaN(parseInt(orgid)) ? null : parseInt(orgid))
      .input(
        "OrgDiv",
        sql.Int,
        isNaN(parseInt(orgdiv)) ? null : parseInt(orgdiv)
      )
      .input(
        "lastupdatedtime",
        sql.DateTime,
        updatedAt ? new Date(updatedAt) : new Date()
      ).query(`
        UPDATE CreatedChecklist
        SET 
          ChecklistName      = @ChecklistName,
          Checklist          = @Checklist,
          AdditionalChecklist= @AdditionalChecklist,
          AIChecklist= @AIChecklist,
          lastupdatedby      = @lastupdatedby,
          lastupdatedtime    = @lastupdatedtime,
          OrgID              = @OrgID,
          OrgDiv             = @OrgDiv
        WHERE ChecklistID = @ChecklistID
      `);

    if (result.rowsAffected[0] === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Checklist not found" });
    }

    res
      .status(200)
      .json({ success: true, message: "Checklist updated successfully" });
  } catch (error) {
    console.error("Error updating checklist:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete("/delete/:id", async (req, res) => {
  try {
    const pool = req.app.locals.db;
    const checklistId = parseInt(req.params.id);


    if (!checklistId || isNaN(checklistId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid checklist ID" });
    }

    const result = await pool
      .request()
      .input("ChecklistID", sql.Int, checklistId).query(`
        UPDATE CreatedChecklist 
        SET Active = 0 
        WHERE ChecklistID = @ChecklistID
      `);

    if (result.rowsAffected[0] === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Checklist not found" });
    }

    res
      .status(200)
      .json({ success: true, message: "Checklist deleted successfully" });
  } catch (error) {
    console.error("Error during checklist delete:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

const uploaded = multer({ storage: multer.memoryStorage() });


router.post(
  "/corpratedocumet",
  uploaded.single("attachment"),
  async (req, res) => {
    console.log("Received document upload request", req.body);
    try {
      const pool = req.app.locals.db;

      const rawDocName = (
        req.body.documentName ||
        req.body.otherDocName ||
        ""
      ).trim();

      if (!rawDocName) {
        return res.status(400).json({
          success: false,
          message: "documentName is required",
        });
      }

      const { orgid, orgdiv, recruiterid, createdAt, candidateId } =
        req.body;

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No file uploaded",
        });
      }

      const orgIdNum = parseInt(orgid, 10);
      const orgDivNum = parseInt(orgdiv, 10);
      const recruiterIdNum = recruiterid
        ? parseInt(recruiterid, 10)
        : null;

      const blobName = await uploadToCopBlob(
        req.file,
        orgIdNum,
        orgDivNum,
        recruiterIdNum,
      );

      const fileUrl = `https://${process.env.AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net/${process.env.AZURE_CONTAINER_NAME}/${blobName}`;

      const result = await pool
        .request()
        .input("OrgId", sql.Int, orgIdNum)
        .input("OrgDiv", sql.Int, orgDivNum)
        .input("RecruiterId", sql.Int, recruiterIdNum)
        .input("DocumentName", sql.VarChar(255), rawDocName)
        .input("FileName", sql.VarChar(255), req.file.originalname)
        .input("FilePath", sql.VarChar(500), blobName)
        .input("Active", sql.Int, 1)
        .input("CreatedAt", sql.VarChar(50), createdAt)
        .query(`
          INSERT INTO CorporateDocuments 
          (OrgId, OrgDiv, RecruiterId, DocumentName, FileName, FilePath, Active, CreatedAt)
          OUTPUT INSERTED.CorporateId
          VALUES
          (@OrgId, @OrgDiv, @RecruiterId, @DocumentName, @FileName, @FilePath, 1, @CreatedAt)
        `);

      const id = result.recordset[0].CorporateId;

      return res.status(201).json({
        success: true,
        message: "Document uploaded to Blob successfully",
        data: {
          id,
          file: {
            originalName: req.file.originalname,
            blobName,
            url: fileUrl,
          },
        },
      });
    } catch (err) {
      console.error("Error uploading corporate document:", err);
      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  }
);

router.get("/getCorporateDocuments", async (req, res) => {
  try {
    const pool = req.app.locals.db;

    const orgid = parseInt(req.query.orgid, 10);
    const orgdiv = parseInt(req.query.orgdiv, 10);
    const recruiterid = parseInt(req.query.recruiterid, 10);

    const request = pool.request();
    const where = ["Active = 1"];

    if (!isNaN(orgid)) {
      request.input("orgid", sql.Int, orgid);
      where.push("OrgId = @orgid");
    }

    if (!isNaN(orgdiv)) {
      request.input("orgdiv", sql.Int, orgdiv);
      where.push("OrgDiv = @orgdiv");
    }

    if (!isNaN(recruiterid)) {
      request.input("recruiterid", sql.Int, recruiterid);
      where.push("RecruiterId = @recruiterid");
    }

    const sqlText = `
      SELECT 
        CorporateId,
        OrgId,
        OrgDiv,
        RecruiterId,
        DocumentName,
        FileName,
        FilePath,
        CreatedAt
      FROM CorporateDocuments
      WHERE ${where.join(" AND ")}
      ORDER BY CorporateId DESC
    `;

    const result = await request.query(sqlText);

    const data = (result.recordset || []).map((doc) => ({
      ...doc,
      fileUrl: `https://${process.env.AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net/${process.env.AZURE_CONTAINER_NAME}/${doc.FilePath}`,
    }));

    res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error("getCorporateDocuments error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

function findOverallRoot() {
  const envRoot =
    process.env.CORP_DOCS_ROOT && path.resolve(process.env.CORP_DOCS_ROOT);

  const candidates = [
    envRoot,

    path.resolve(__dirname, "..", "tresume3-0", "Overall_Document"),
  ].filter(Boolean);

  for (const p of candidates) {
    try {
      if (p && fs.existsSync(p)) return p;
    } catch {}
  }

  let dir = __dirname;
  for (let i = 0; i < 6; i++) {
    const probe = path.resolve(dir, "Overall_Document");
    try {
      if (fs.existsSync(probe)) return probe;
    } catch {}
    dir = path.resolve(dir, "..");
  }
  return null;
}

router.post("/CorporateDocumentsdownloadonboard", (req, res) => {
  try {
    const overallRoot = findOverallRoot();
    if (!overallRoot || !fs.existsSync(overallRoot)) {
      console.error("❌ Server storage root missing", {
        overallRoot,
        __dirname,
        cwd: process.cwd(),
        CORP_DOCS_ROOT: process.env.CORP_DOCS_ROOT || null,
      });
      return res.status(500).send("Server storage root missing");
    }

    const source =
      req.body && Object.keys(req.body).length ? req.body : req.query;
    let rawPath = String(source.filePath || source.fileName || "").trim();
    if (!rawPath) return res.status(400).send("Missing file path");

    try {
      rawPath = decodeURIComponent(rawPath);
    } catch {}

    rawPath = rawPath.replace(/^[\\/]+/, "");
    rawPath = rawPath.replace(/^overall[_-]?document[\\/]+/i, "");

    const absPath = path.resolve(overallRoot, rawPath);

    const rel = path.relative(overallRoot, absPath);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      console.warn("Blocked path traversal attempt", {
        overallRoot,
        absPath,
        rel,
      });
      return res.status(403).send("Access denied");
    }

    if (!fs.existsSync(absPath)) {
      console.error("❌ File not found:", absPath);
      try {
        console.log(
          "Parent dir listing:",
          fs.readdirSync(path.dirname(absPath))
        );
      } catch {}
      return res.status(404).send("File not found");
    }

    const fileName = path.basename(absPath);
    const contentType =
      (typeof mime.lookup === "function"
        ? mime.lookup(fileName)
        : typeof mime.getType === "function"
        ? mime.getType(fileName)
        : null) || "application/octet-stream";

    if (
      String(contentType).startsWith("application/pdf") ||
      String(contentType).startsWith("image/")
    ) {
      res.setHeader("Content-Type", contentType);
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${encodeURIComponent(fileName)}"`
      );
      return res.sendFile(absPath, (err) => {
        if (err) {
          console.error("sendFile error:", err);
          if (err.code === "ENOENT")
            return res.status(404).send("File not found");
          return res.status(500).send("Read error");
        }
      });
    }

    res.setHeader("Content-Type", contentType);
    return res.download(absPath, fileName, (err) => {
      if (err) {
        console.error("download error:", err);
        if (err.code === "ENOENT")
          return res.status(404).send("File not found");
        return res.status(500).send("Read error");
      }
    });
  } catch (err) {
    console.error("[CorporateDocumentsdownloadonboard] handler error:", err);
    return res.status(500).send("Internal server error");
  }
});

router.put("/delete/:corporateId", async (req, res) => {
  try {
    const corporateId = req.params.corporateId;

    const pool = req.app.locals.db;
    const result = await pool
      .request()
      .input("CorporateId", sql.Int, corporateId).query(`
        UPDATE dbo.CorporateDocuments
        SET Active = 0
        WHERE CorporateId = @CorporateId
      `);

    if (result.rowsAffected[0] > 0) {
      res.status(200).json({ message: "Document deactivated successfully" });
    } else {
      res.status(404).json({ message: "Document not found" });
    }
  } catch (error) {
    console.error("Error updating document status:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
