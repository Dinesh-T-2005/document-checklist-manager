import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment'; // ✅ Fixed path casing
// import { ChecklistTemplate } from '../models';
export interface ChecklistItem {
  id: string;
  name: string;
  category?: string;
  isMandatory?: boolean;
  orgid?: number;
  orgdiv?: number;
}

export interface ChecklistTemplate {
  templateId?: string | number;
  checklist: ChecklistItem[];
  createdAt?: string;
  // UI / server-side metadata (optional)
  templateName?: string;
  industry?: string;
  orgid?: number;
  orgdiv?: number;
  email?: string;
  RecruiterID?: number;
}


export interface Document {
  id: string;
  name: string;
  type: string;
  selected?: boolean;
}


@Injectable({
  providedIn: 'root'
})
export class DocumentsService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  getDocuments(accessType?: number, orgid?: string, orgDiv?: string, recruiterid?: string) {
    return this.http.get<{ success: boolean; data: any[] }>(
      `${this.apiUrl}document/checklistDocuments`,
      {
        params: {
          ...(accessType != null ? { accessType: String(accessType) } : {}),
          ...(orgid ? { orgid } : {}),
          ...(orgDiv ? { orgdiv: orgDiv } : {}),
          ...(recruiterid ? { recruiterid } : {}),
        }
      }
    );
  }

  getCorporateType() {
    return this.http.get<{ success: boolean; data: any[] }>(
      `${this.apiUrl}document/corporate_type`)
  }

  createDocuments(req: any): Observable<any> {
    return this.http.post(`${this.apiUrl}document/createDocuments`, req);
  }

  documentCreate(req: any): Observable<any> {
    return this.http.post(`${this.apiUrl}document/AdditionaldocumentCreate`, req);
  }

  getDetails(accessType: number, orgid: string, orgDiv: string, recruiterid: string): Observable<any> {
    return this.http.get(`${this.apiUrl}document/Checklistdetails`, {
      params: {
        accessType: accessType.toString(),
        orgid,
        orgDiv,
        recruiterid
      }
    });
  }

  updateChecklist(req: any): Observable<any> {
    return this.http.put(`${this.apiUrl}document/update`, req);
  }


  deleteChecklist(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}document/delete/${id}`);
  }

  //  corpratedocumet(req: any): Observable<any> {
  //     return this.http.put(`${this.apiUrl}document/corpratedocumet`, req);
  //   }

  // documents.service.ts
  corpratedocumet(formData: FormData): Observable<any> {
    return this.http.post(`${this.apiUrl}document/corpratedocumet`, formData);
  }


  getCorporateDocuments(orgid?: string, orgdiv?: string, recruiterid?: string) {
    // Ensure base has trailing slash OR include it here:
    return this.http.get<{ success: boolean; data: any[] }>(
      `${this.apiUrl}document/getCorporateDocuments`,
      {
        params: {
          ...(orgid ? { orgid } : {}),
          ...(orgdiv ? { orgdiv } : {}),
          ...(recruiterid ? { recruiterid } : {}),
        }
      }
    );
  }


  getOnboardDocument(body: any) {
    return this.http.post(
      this.apiUrl + 'onboarding/downloadonboard',
      body,
      { responseType: 'blob' }
    );
  }

  deleteCommonDoc(corporateId: number): Observable<any> {
    return this.http.put(`${this.apiUrl}document/delete/${corporateId}`, {});
  }

  // generate(prompt: string): Observable<ChecklistTemplate> {
  //   return this.http.post<ChecklistTemplate>(`${this.apiUrl}checklistai/generate`, { prompt });
  // }

  saveTemplate(template: ChecklistTemplate): Observable<any> {
    return this.http.post(`${this.apiUrl}checklistai/save`, template);
  }

  getTemplates(orgdiv: number, orgid: number, recruiterid: number): Observable<ChecklistTemplate[]> {
    return this.http.get<ChecklistTemplate[]>(`${this.apiUrl}checklistai/templates`, {
      params: {
        orgid,
        orgdiv,
        recruiterid
      }
    });
  }

  generateDocument(payload: any) {
    return this.http.post(`${this.apiUrl}checklistai/generate`, payload);
  }




}












