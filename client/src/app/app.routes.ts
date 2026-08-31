import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: 'auth/login',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'auth/register',
    loadComponent: () => import('./features/auth/register/register.component').then(m => m.RegisterComponent)
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
  },
  {
    path: 'grievances',
    canActivate: [authGuard],
    loadComponent: () => import('./features/grievances/grievance-list/grievance-list.component').then(m => m.GrievanceListComponent)
  },
  {
    path: 'grievances/create',
    canActivate: [authGuard],
    loadComponent: () => import('./features/grievances/grievance-create/grievance-create.component').then(m => m.GrievanceCreateComponent)
  },
  {
    path: 'grievances/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./features/grievances/grievance-detail/grievance-detail.component').then(m => m.GrievanceDetailComponent)
  },
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard(['admin'])],
    loadComponent: () => import('./features/admin/admin.component').then(m => m.AdminComponent)
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
