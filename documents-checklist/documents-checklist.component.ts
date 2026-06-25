import { Component, ViewChild, TemplateRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { CookieService } from 'ngx-cookie-service';
import { trigger, transition, style, animate } from '@angular/animations';

import { EncryptedCookieService } from 'src/app/services/encrypted-cookie.service';
import { DocumentsService } from '../documents.service';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatExpansionModule } from '@angular/material/expansion';
import { ChangeDetectorRef } from '@angular/core';
import { MatOptionModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';

// Icons
import { TablerIconsModule } from 'angular-tabler-icons';
import { Router } from '@angular/router';
import { myprofileService } from 'src/app/pages/MyProfile/myprofile.service';
import { MatSnackBar } from '@angular/material/snack-bar';
interface DocumentItem {
  id: string;
  DocsName: string;
  selected?: boolean;
  checklistName?: string;
}

@Component({
  selector: 'app-documents-checklist',
  standalone: true,
  templateUrl: './documents-checklist.component.html',
  styleUrls: ['./documents-checklist.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatExpansionModule,
    TablerIconsModule,
    MatOptionModule,
    MatSelectModule
  ],
  providers: [CookieService, DocumentsService],
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [style({ opacity: 0 }), animate('200ms ease-in-out', style({ opacity: 1 }))]),
      transition(':leave', [animate('150ms ease-in-out', style({ opacity: 0 }))])
    ])
  ]
})
export class DocumentsChecklistComponent implements OnInit {
  documents: any[] = [];
  details: any[] = [];
  filteredDetails: any[] = [];
  postedDocuments: any[] = [];
  selectedDocuments: any[] = [];

  loading = false;
  error = false;
  showModal = false;
  showDeleteModal = false;
  showAllDocuments = false;
  showlabels = false;
  isEditMode = false;

  itemsPerPage = 9;
  currentPage = 1;
  filterText = '';
  filterDetails = '';
  labelShowMoreMap: { [key: number]: boolean } = {};

  form: FormGroup;
  checklistName = '';
  checklistNameInput = '';
  docName = '';
  step = 0;
  panelOpenState = false;

  selectedChecklist: any;
  editChecklistId: any = null;
  documentToDelete: any;
  checklistToDelete: any;
  selectedorgdiv: any;

  orgid: any;
  orgdiv: any;
  recruiterid: any;
  email: any;
  accesstype: any;
  userEmail: string = '';

  isDuplicate = false;
  isEmptyName = false;


  @ViewChild('modalTemplate') modalTemplate!: TemplateRef<any>;

  constructor(
    private fb: FormBuilder,
    private toastr: ToastrService,
    private documentsService: DocumentsService,
    private encryptedCookieService: EncryptedCookieService,
    private cdr: ChangeDetectorRef,
    private route: Router,
    private myprofile: myprofileService,
    private snackBar: MatSnackBar
  ) {
    this.accesstype = this.encryptedCookieService.getCookie('AccessType');
    this.orgid = this.encryptedCookieService.getCookie('orgId');
    this.orgdiv = this.encryptedCookieService.getCookie('divisionId');
    this.recruiterid = this.encryptedCookieService.getCookie('userId');
    this.email = this.encryptedCookieService.getCookie('email');

    this.form = this.fb.group({
      checklistLabels: [[]],
    });
  }

  ngOnInit() {
    this.accesstype = this.encryptedCookieService.getCookie('AccessType');
    this.orgid = this.encryptedCookieService.getCookie('orgId');
    this.orgdiv = this.encryptedCookieService.getCookie('divisionId');
    this.recruiterid = this.encryptedCookieService.getCookie('userId');
    this.email = this.encryptedCookieService.getCookie('email');

    if (this.accesstype === '1') {
      this.getorgdivision();
    }

    this.loading = true;
    this.getDocuments(() => this.getdetails());
  }

  getDocumentLabels(ids: number[]): string[] {
    if (!Array.isArray(ids) || ids.length === 0) return [];
    return (this.documents || [])
      .filter((d: any) => ids.includes(Number(d.Id)))
      .map((d: any) => d.DocsName);
  }

  getChecklistLabels(baseIds: number[], additionalIds: number[], AIID: number[]): string[] {
    const baseSet = new Set((baseIds || []).map(Number));
    const addSet = new Set((additionalIds || []).map(Number));
    const aiSet = new Set((AIID || []).map(Number));
    const labels: { key: string; name: string }[] = [];

    for (const d of this.documents || []) {
      const id = Number(d.Id);
      if (d.Source === 'base' && baseSet.has(id)) {
        labels.push({ key: `b-${id}`, name: d.DocsName });
      } else if (d.Source === 'additional' && addSet.has(id)) {
        labels.push({ key: `a-${id}`, name: d.DocsName });
      }
      else if (d.Source === 'AI' && aiSet.has(id)) {
        labels.push({ key: `a-${id}`, name: d.DocsName });
      }
    }

    const seen = new Set<string>();
    return labels
      .filter(x => (seen.has(x.key) ? false : (seen.add(x.key), true)))
      .map(x => x.name);
  }

  getRelativeTime(date: string | Date): string {
    const now = new Date();
    const diff = (now.getTime() - new Date(date).getTime()) / 1000;

    if (diff < 60) return 'Just now';
    if (diff < 3600) return Math.floor(diff / 60) + ' mins ago';
    if (diff < 86400) return Math.floor(diff / 3600) + ' hours ago';
    if (diff < 172800) return 'Yesterday';
    if (diff < 604800) return Math.floor(diff / 86400) + ' days ago';
    if (diff < 2419200) return Math.floor(diff / 604800) + ' weeks ago';
    if (diff < 29030400) return Math.floor(diff / 2419200) + ' months ago';
    if (diff < 315360000) return Math.floor(diff / 29030400) + ' years ago';
    return new Date(date).toLocaleString();
  }

  RelativeTime(date: string | Date | null): string {
    if (!date) return '';
    const now = new Date();
    const diff = (now.getTime() - new Date(date).getTime()) / 1000;

    if (diff < 60) return 'Just now';
    if (diff < 3600) return Math.floor(diff / 60) + ' mins ago';
    if (diff < 86400) return Math.floor(diff / 3600) + ' hours ago';
    if (diff < 172800) return 'Yesterday';
    if (diff < 604800) return Math.floor(diff / 86400) + ' days ago';
    if (diff < 2419200) return Math.floor(diff / 604800) + ' weeks ago';
    if (diff < 29030400) return Math.floor(diff / 2419200) + ' months ago';
    if (diff < 315360000) return Math.floor(diff / 29030400) + ' years ago';
    return new Date(date).toLocaleString();
  }


  private selectionSet = new Set<number>();

  private snapshotSelection(): void {
    this.selectionSet = new Set(
      (this.documents || [])
        .filter((d: any) => d.selected)
        .map((d: any) => Number(d.Id))
    );
  }

  private restoreSelection(): void {
    if (!this.documents?.length) return;
    this.documents.forEach((d: any) => {
      d.selected = this.selectionSet.has(Number(d.Id));
    });
  }


  getDocuments(callback?: () => void) {
    this.loading = true;
    this.error = false;

    this.documentsService
      .getDocuments(this.accesstype, this.orgid, this.orgdiv, this.recruiterid)
      .subscribe({
        next: (res) => {
          const seenAiNames = new Set<string>();

          this.documents = (res?.data || []).map((d: any) => {
            const originalName: string = d.DocsName || '';
            let displayName: string = originalName;


            if (d.Source === 'AI') {
              const key = originalName.trim().toLowerCase();
              if (key) {
                if (seenAiNames.has(key)) {

                  displayName = '';
                } else {

                  seenAiNames.add(key);
                }
              }
            }

            return {
              ...d,
              Id: Number(d.Id),
              DocsName: originalName,
              DisplayDocsName: displayName,
              Type: d.Type,
              Source: d.Source,
              selected: this.selectionSet.has(Number(d.Id)),
              selectedorgdiv: d.OrgDiv || null
            };
          });


          this.loading = false;
          if (callback) callback();
        },
        error: (err) => {
          console.error('Error fetching documents:', err);
          this.error = true;
          this.loading = false;
        }
      });
  }


  getdetails() {
    this.documentsService
      .getDetails(this.accesstype, this.orgid, this.orgdiv, this.recruiterid)
      .subscribe({
        next: (response: any) => {

          if (!response?.data || response.data.length === 0) {
            this.toastr.info('No document found');
            this.loading = false;
            return;
          }
          this.details = (response?.data || []).map((item: any) => {
            const rawBase = item.Checklist ?? item.checklist ?? '[]';
            const rawAdditional = item.AdditionalChecklist ?? item.additionalChecklist ?? '[]';
            const AI = item.AIChecklist ?? item.AIChecklist ?? '[]';

            let baseIds: number[] = [];
            let additionalIds: number[] = [];
            let AIID: number[] = [];

            try { baseIds = Array.isArray(rawBase) ? rawBase.map(Number) : JSON.parse(rawBase || '[]').map(Number); } catch { }
            try { additionalIds = Array.isArray(rawAdditional) ? rawAdditional.map(Number) : JSON.parse(rawAdditional || '[]').map(Number); } catch { }
            try { AIID = Array.isArray(AI) ? AI.map(Number) : JSON.parse(AI || '[]').map(Number); } catch { }

            const checklistLabels = this.getChecklistLabels(baseIds, additionalIds, AIID);

            return {
              ...item,
              baseDocIds: baseIds,
              additionalDocIds: additionalIds,
              AIDoc: AIID,
              checklistDocIds: [...baseIds, ...additionalIds, ...AIID],
              checklistLabels,
              checklistName: item.ChecklistName ?? item.checklistName,
              CreateBy: item.CreateBy ?? item.createBy,
              ChecklistID: item.ChecklistID ?? item.checklistid
            };
          });

          this.loading = false;
        },
        error: (err) => {
          console.error('Error fetching document details:', err);
          this.loading = false;
        }
      });
  }


  openModal(checklist?: any) {
    this.showModal = true;
    this.selectedChecklist = checklist;
    if (!this.details.length) {
      this.getdetails();
    }

    this.showModal = true;
    this.selectedChecklist = checklist;

    if (checklist) {
      this.isEditMode = true;
      this.editChecklistId = checklist.ChecklistID;
      this.checklistName = checklist.checklistName;
      this.selectedorgdiv = checklist.orgdiv || checklist.OrgDiv || null;

      const baseSet = new Set((checklist.baseDocIds || []).map(Number));
      const addSet = new Set((checklist.additionalDocIds || []).map(Number));
      const aiSet = new Set((checklist.AIDoc || []).map(Number));


      this.getDocuments(() => {
        this.documents.forEach((doc: any) => {
          const id = Number(doc.Id);
          if (doc.Source === 'AI') {
            doc.selected = aiSet.has(id);
          } else if (doc.Source === 'additional') {
            doc.selected = addSet.has(id);
          } else {
            doc.selected = baseSet.has(id);
          }
        });
        this.applyAiNameCollapsing();
      });

    } else {
      this.isEditMode = false;
      this.editChecklistId = null;
      this.checklistName = '';
      this.form.reset();
      this.getDocuments(() => this.restoreSelection());
    }
  }

  closeModal() {
    this.showModal = false;
    this.isEditMode = false;
    this.editChecklistId = null;
    this.checklistName = '';
    this.selectionSet.clear();
    this.documents.forEach(doc => (doc.selected = false));
  }
  trackById(_: number, doc: any) {
    return doc?.Id;
  }


  documentCreate() {
    if (!this.docName.trim()) {
      this.toastr.error('Please enter a document name!');
      return;
    }

    const now = new Date().toISOString();
    const req = {
      fullName: this.docName,
      orgid: this.orgid,
      orgdiv: this.orgdiv,
      recruiterid: this.recruiterid,
      createdAt: now
    };
    this.snapshotSelection();

    this.documentsService.documentCreate(req).subscribe({
      next: (created: any) => {
        this.toastr.success('Document created successfully!');
        this.docName = '';

        this.getDocuments(() => {

          const newId = Number(created?.data?.Id);
          if (newId) {
            this.selectionSet.add(newId);
            this.restoreSelection();
          }
        });
      },
      error: (err) => {
        console.error('Error creating document:', err);
        this.toastr.error('Error creating document!');
      }
    });
  }

  saveSelection() {
    this.loading = true;
    const now = new Date().toISOString();

    const baseIds = this.documents
      .filter(d => d.selected && (d.Source === 'base' || d.Source == null))
      .map(d => Number(d.Id));

    const additionalIds = this.documents
      .filter(d => d.selected && d.Source === 'additional')
      .map(d => Number(d.Id));

    const AIID = this.documents
      .filter(d => d.selected && d.Source === 'AI')
      .map(d => Number(d.Id));


    if (!this.checklistName.trim()) {
      this.toastr.error('Please enter a checklist name!');
      this.loading = false;
      return;
    }
    if (baseIds.length === 0 && additionalIds.length === 0 && AIID.length === 0) {
      this.toastr.error('Please select at least one document!');
      this.loading = false;
      return;
    }
    let orgDivValue;

    if (this.accesstype === '1') {
      orgDivValue = this.selectedorgdiv;
    } else {
      orgDivValue = this.orgdiv;
    }


    const req = {
      orgid: this.orgid,
      orgdiv: orgDivValue,
      recruiterid: this.recruiterid,
      accesstype: this.accesstype,
      documents: [
        {
          baseIds,
          additionalIds,
          AIID,
          checklistName: this.checklistName,
          DocsCreatedBy: this.email,
          createdAt: now
        }
      ]
    };

    this.documentsService.createDocuments(req).subscribe({
      next: (response: any) => {
        this.postedDocuments = response?.data || [];
        // this.toastr.success('Checklist added successfully!');
        this.getdetails();
        this.showModal = false;
        this.loading = false;
        this.selectedorgdiv = null;
        setTimeout(() => {
          const snack = this.snackBar.open(
            ` Checklist created successfully!. see the Onboarding Details?`,
            'View Onboarding Details',
            {
              duration: 12000,
              horizontalPosition: 'right',
              verticalPosition: 'top',
              panelClass: ['retry-snackbar']
            }
          );


          snack.onAction().subscribe(() => {
            this.route.navigate(['/ats/job/RecruitmentHub/Onboardingdetails']);
          });
        }, 0);
      },
      error: (err) => {
        console.error('Error saving documents:', err);
        this.toastr.error('Error saving checklist!', err);
        this.loading = false;
      }
    });
  }

  updateChecklist() {
    const checklistId = Number(this.editChecklistId);
    if (isNaN(checklistId)) {
      console.error('ChecklistID is not valid:', this.editChecklistId);
      return;
    }

    const selected = this.documents.filter((d: any) => d.selected);
    const baseIds = selected
      .filter((d: any) => d.Source === 'base' || d.Source == null)
      .map((d: any) => Number(d.Id));

    const additionalIds = selected
      .filter((d: any) => d.Source === 'additional')
      .map((d: any) => Number(d.Id));

    const AIID = selected
      .filter((d: any) => d.Source === 'AI')
      .map((d: any) => Number(d.Id));

    if (!this.checklistName?.trim()) {
      this.toastr.error('Checklist name is required!');
      return;
    }
    if (baseIds.length === 0 && additionalIds.length === 0 && AIID.length === 0) {
      this.toastr.error('Please select at least one document!');
      return;
    }
    let orgDivValue;

    if (this.accesstype === '1') {
      orgDivValue = this.selectedorgdiv;
    } else {
      orgDivValue = this.orgdiv;
    }


    const req = {
      checklistId,
      checklistName: this.checklistName,
      recruiterid: this.recruiterid,
      orgid: this.orgid,
      orgdiv: orgDivValue,
      accessType: this.accesstype,
      DocsUpdatedBy: this.recruiterid,
      updatedAt: new Date().toISOString(),
      documents: baseIds,
      additionalIds,
      AIID
    };

    this.documentsService.updateChecklist(req).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.closeModal();
          this.getdetails();
          this.isEditMode = false;
          this.toastr.success('Update Checklist successfully!');
        } else {
          console.warn('Update failed:', res.message);
        }
      },
      error: (err) => {
        console.error('Error updating checklist:', err);
        this.toastr.error('Error updating checklist!');
      }
    });
  }

  confirmDelete(checklistId: string | number) {
    this.checklistToDelete = this.details.find((d: any) => d.ChecklistID === checklistId);
    this.showDeleteModal = true;
  }

  cancelDelete() {
    this.checklistToDelete = null;
    this.showDeleteModal = false;
  }

  deleteConfirmed() {
    this.loading = true;

    if (!this.checklistToDelete?.checklistid) {
      this.toastr.error('Invalid checklist ID for deletion');
      return;
    }

    this.documentsService.deleteChecklist(String(this.checklistToDelete.checklistid)).subscribe({
      next: () => {
        this.toastr.success('Checklist deleted successfully!');
        this.showDeleteModal = false;
        this.loading = false;
        this.getdetails();
      },
      error: (err) => {
        this.toastr.error('Error deleting checklist!');
        console.error('Error deleting checklist:', err);
        this.showDeleteModal = false;
      }
    });
  }


  getFilteredDetails() {
    const search = this.filterDetails.trim().toLowerCase();
    const filtered = this.details.filter(doc =>
      doc.checklistName?.toLowerCase().includes(search) ||
      doc.CreateBy?.toLowerCase().includes(search)
    );
    return this.showAllDocuments ? filtered : filtered.slice(0, 8);
  }

  get pages(): number[] {
    return Array(this.totalPages).fill(0).map((_, i) => i + 1);
  }

  get visibleDetails() {
    const search = this.filterDetails.trim().toLowerCase();
    const filtered = this.details.filter(doc =>
      doc.checklistName?.toLowerCase().includes(search) ||
      doc.CreateBy?.toLowerCase().includes(search)
    );

    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return filtered.slice(start, end);
  }

  get totalPages(): number {
    const search = this.filterDetails.trim().toLowerCase();
    const filtered = this.details.filter(doc =>
      doc.checklistName?.toLowerCase().includes(search) ||
      doc.CreateBy?.toLowerCase().includes(search)
    );
    return Math.ceil(filtered.length / this.itemsPerPage);
  }

  goToPage(page: number) {
    this.currentPage = page;
  }

  nextPage() {
    if (this.currentPage < this.totalPages) this.currentPage++;
  }

  prevPage() {
    if (this.currentPage > 1) this.currentPage--;
  }


  get selectedCount(): number {
    return (this.documents || []).filter((d: any) => d.selected).length;
  }

  get selectedDocs(): any[] {
    return (this.documents || []).filter((d: any) => d.selected);
  }

  getFilteredDocuments() {
    const text = (this.filterText || '').trim().toLowerCase();

    return (this.documents || [])
      .filter((doc: any) =>
        (doc?.DocsName || '').toLowerCase().includes(text) ||
        (doc?.Type || '').toLowerCase().includes(text)
      )
      .sort((a: any, b: any) => {
        const selDiff = Number(!!b.selected) - Number(!!a.selected);
        if (selDiff !== 0) return selDiff;
        return (a.DocsName || '').localeCompare(b.DocsName || '', undefined, { sensitivity: 'base' });
      });
  }

  toggleSelect(doc: any) {
    doc.selected = !doc.selected;
  }

  clearSelected() {
    (this.documents || []).forEach((d: any) => (d.selected = false));
  }

  getSelectedIds(): number[] {
    return this.selectedDocuments?.map((doc: any) => Number(doc)) || [];
  }

  hasAnySelected(): boolean {
    return this.documents.some(doc => doc.selected);
  }

  toggleShow(index: number) {
    this.labelShowMoreMap[index] = !this.labelShowMoreMap[index];
  }

  private duplicateToastRef?: import('ngx-toastr').ActiveToast<any>;

  onChecklistNameChange(value: string): void {
    this.checklistName = value || '';
    const trimmed = this.checklistName.trim().toLowerCase();

    this.isEmptyName = trimmed.length === 0;

    if (!this.details || this.details.length === 0 || !trimmed) {
      this.isDuplicate = false;

      if (this.duplicateToastRef) {
        this.toastr.clear(this.duplicateToastRef.toastId);
        this.duplicateToastRef = undefined;
      }

      this.cdr.detectChanges();
      return;
    }

    const wasDuplicate = this.isDuplicate;
    this.isDuplicate = this.details.some((doc: any) => {
      const existing = (doc.ChecklistName || doc.checklistName || '')
        .trim()
        .toLowerCase();
      if (this.isEditMode && doc.ChecklistID === this.editChecklistId) return false;
      return existing === trimmed;
    });

    if (this.isDuplicate && !wasDuplicate) {
      if (this.duplicateToastRef) {
        this.toastr.clear(this.duplicateToastRef.toastId);
        this.duplicateToastRef = undefined;
      }
      this.duplicateToastRef = this.toastr.warning(
        'This checklist name already exists. Please choose another.',
        'Duplicate name'
      );
    }

    if (!this.isDuplicate && wasDuplicate && this.duplicateToastRef) {
      this.toastr.clear(this.duplicateToastRef.toastId);
      this.duplicateToastRef = undefined;
    }

    this.cdr.detectChanges();
  }

  routingchecklist() {
    const state = {
      orgid: this.orgid,
      recruiterid: this.recruiterid,
      source: "checklist"
    }
    this.route.navigate(['/ats/checklistai'], { state })
  }

  private applyAiNameCollapsing(): void {

    this.documents.forEach((d: any) => {
      d.DisplayDocsName = d.DocsName;
      d._visible = true;
    });

    const groups = new Map<string, any[]>();

    for (const doc of this.documents) {
      if (doc.Source !== 'AI') continue;

      const key = (doc.DocsName || '').trim().toLowerCase();
      if (!key) continue;

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(doc);
    }

    for (const [, docs] of groups) {
      if (!docs.length) continue;

      let primary = docs.find(d => d.selected) || docs[0];

      for (const d of docs) {
        if (d === primary) {
          d.DisplayDocsName = d.DocsName;
          d._visible = true;
        } else {
          d.DisplayDocsName = '';
          d._visible = false;
        }
      }
    }
  }

  orgdivision: any[] = []
  getorgdivision() {
    this.myprofile.getDivision(this.orgid).subscribe((x: any) => {
      this.orgdivision = x;

    },
      (err: any) => {
        console.error('Error fetching org division', err);
      }
    )

  }
}
