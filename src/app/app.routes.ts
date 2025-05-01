import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { SearchComponent } from './components/search/search.component';
import { CallbackComponent } from './components/callback/callback.component';
import { TopChartsComponent } from './components/top-charts/top-charts.component';
import { NewReleasesComponent } from './components/new-releases/new-releases.component';
import { UserStatsComponent } from './components/user-stats/user-stats.component';
import { MixGeneratorComponent } from './components/mix-generator/mix-generator.component';
import { LibraryExplorerComponent } from './components/library-explorer/library-explorer.component';

export const routes: Routes = [
    { path: '', component: HomeComponent },
    { path: 'search', component: SearchComponent },
    { path: 'callback', component: CallbackComponent },
    { path: 'charts', component: TopChartsComponent },
    { path: 'new-releases', component: NewReleasesComponent },
    { path: 'stats', component: UserStatsComponent },
    { path: 'mix-generator', component: MixGeneratorComponent },
    { path: 'library', component: LibraryExplorerComponent },
    { path: '**', redirectTo: '' }
];
